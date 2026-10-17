import { test, expect, type Page } from '@playwright/test';
import {
	BEARER,
	FIXTURE_CLASS_LABEL,
	FIXTURE_COURSE,
	openPage,
	resetTo,
	standingKey
} from './helpers.ts';

// A Teaching note follows its Lesson when a write moves the Lesson (ADR-0026), and writing a
// Lesson changes no Class's dates. It gives 9C/Sc1 from the standard state (Tuesday P3, Open
// Slots) one Topic of one Lesson and one Topic of two Lessons in KS3 Science, assigns them
// through the Sequence tab, notes the Session that the first Lesson of the second Topic fills,
// and undoes all of it at the end.

test.beforeAll(() => resetTo('standard'));

test.describe.serial('a Teaching note and the Sequence after a Lesson write', () => {
	let page: Page;
	let token = '';
	let courseId = '';
	const topicIds: string[] = [];

	async function post(url: string, data: object) {
		const response = await page.request.post(url, { headers: BEARER(token), data });
		expect(response.status()).toBe(201);
		return response.json();
	}

	// The Class page of the fixture Class.
	async function openFixtureClass() {
		await page.goto('/classes');
		await page
			.getByRole('link', { name: new RegExp(FIXTURE_CLASS_LABEL) })
			.first()
			.click();
		await expect(page).toHaveURL(/\/classes\/[^/]+$/);
	}

	function nextSessions() {
		return page
			.locator('section')
			.filter({ has: page.getByRole('heading', { name: 'Next Sessions' }) })
			.locator('li');
	}

	// The Session page of the nth Session the Class teaches next.
	async function openNextSession(index: number) {
		await openFixtureClass();
		await nextSessions().nth(index).getByRole('link').first().click();
		await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
	}

	// × on a card of the Sequence tab takes the Lesson out of this Class and keeps the Lesson.
	async function removeFromSequence(title: string) {
		await openFixtureClass();
		await page.getByRole('tab', { name: /^Sequence/ }).click();
		await page.getByRole('button', { name: `Remove ${title}` }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click();
		await expect(page.locator('[data-remove-result]')).toContainText('Removed 1 Lesson.');
	}

	test.beforeAll(async ({ browser }) => {
		page = await openPage(browser);
		token = await standingKey(page);

		const courses = await (
			await page.request.get('/api/courses', { headers: BEARER(token) })
		).json();
		courseId = courses.find((c: { name: string }) => c.name === FIXTURE_COURSE).id;
		for (const [name, titles] of [
			['Rewind A', ['A one']],
			['Rewind B', ['B one', 'B two']]
		] as const) {
			const topic = await post(`/api/courses/${courseId}/topics`, { name });
			topicIds.push(topic.id);
			for (const title of titles) await post(`/api/topics/${topic.id}/lessons`, { title });
		}

		await openFixtureClass();
		await page.getByRole('tab', { name: /^Sequence/ }).click();
		for (const [name, added] of [
			['Rewind A', 'Added 1 Lesson'],
			['Rewind B', 'Added 2 Lessons']
		]) {
			await page.getByRole('button', { name: 'Assign Topic' }).click();
			await page.getByRole('menuitem', { name: new RegExp(`^${name} `) }).click();
			await expect(page.getByText(`${added} from ${name}.`)).toBeVisible();
		}

		// The second Session the Class teaches carries 'B one'. Note it.
		await openNextSession(1);
		const note = page.getByLabel('How it went');
		await expect(note).toBeVisible();
		await note.click();
		await note.pressSequentially('book the ripple tank');
		await page.getByRole('button', { name: 'Back' }).click();
	});

	test.afterAll(async () => {
		// Remove takes each Lesson out of the Class's Sequence, with its Teaching note, and keeps
		// the Lesson. The Class has no Sequence again, and the Lessons then delete without a confirm.
		for (const title of ['A one', 'B one', 'B two']) await removeFromSequence(title);

		for (const id of topicIds) {
			const lessons = await (
				await page.request.get(`/api/topics/${id}/lessons`, { headers: BEARER(token) })
			).json();
			for (const lesson of lessons) {
				await page.request.delete(`/api/lessons/${lesson.id}`, { headers: BEARER(token) });
			}
			await page.request.delete(`/api/topics/${id}`, { headers: BEARER(token) });
		}
		await page.close();
	});

	test('a Lesson moved in front of a noted Lesson moves its Teaching note to the new date', async () => {
		await openFixtureClass();
		await page.goto(`${page.url()}?layout=list`);
		await page.getByRole('tab', { name: /^Sequence/ }).click();
		const titles = page.locator('[data-sequence] [data-title]');
		await expect(titles).toHaveText(['A one', 'B one', 'B two']);

		// 'B two' takes the place of 'B one': 'B one' moves from the second Session to the third.
		const grip = await page.getByRole('button', { name: 'Drag B two' }).boundingBox();
		const card = await page
			.locator('[data-sequence] > li')
			.filter({ hasText: 'B one' })
			.boundingBox();
		await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + grip!.height / 2);
		await page.mouse.down();
		await page.mouse.move(card!.x + card!.width / 2, card!.y + card!.height / 2, { steps: 6 });
		await page.mouse.up();
		await expect(titles).toHaveText(['A one', 'B two', 'B one']);

		// The note went with 'B one' to the third Session, and the second Session has none.
		await openNextSession(2);
		await expect(page.locator('main')).toContainText('B one');
		await expect(page.getByLabel('How it went')).toHaveText('book the ripple tank');
		await page.getByRole('button', { name: 'Back' }).click();

		await nextSessions().nth(1).getByRole('link').first().click();
		await expect(page.locator('main')).toContainText('B two');
		await expect(page.getByLabel('How it went')).toHaveText('');
		await page.getByRole('button', { name: 'Back' }).click();
	});

	test('a Lesson added in a Topic changes no date in the Class', async () => {
		await openFixtureClass();
		const before = await nextSessions().allInnerTexts();
		expect(before[0]).toContain('A one');

		await page.goto(`/courses/${courseId}?topic=${topicIds[1]}`);
		await expect(page.getByRole('link', { name: 'B one', exact: true })).toBeVisible();
		const box = page.getByPlaceholder('New Lesson title — press Enter');
		await box.fill('B extra');
		await box.press('Enter');
		await expect(page.getByRole('link', { name: 'B extra', exact: true })).toBeVisible();
		await expect(box).toBeFocused();

		// The new Lesson joins no Sequence: the Class has the same Sessions and three Lessons.
		await openFixtureClass();
		expect(await nextSessions().allInnerTexts()).toEqual(before);
		await expect(page.getByRole('tab', { name: 'Sequence 3' })).toBeVisible();
	});
});
