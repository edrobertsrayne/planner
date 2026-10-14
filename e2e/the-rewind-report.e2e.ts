import { test, expect, type Page } from '@playwright/test';
import { expectToast, resetTo } from './helpers.ts';
import {
	BEARER,
	FIXTURE_CLASS_LABEL,
	FIXTURE_COURSE,
	openPage,
	standingKey
} from './the-planning-api/helpers.ts';

// A Teaching note follows its Lesson when a write moves the Lesson (ADR-0026), and writing a
// Lesson changes no Class's dates. It gives 9C/Sc1 from the standard state (Tuesday P3, Open
// Slots) two Topics of one Lesson each in KS3 Science, assigns them through the Sequence tab,
// notes the Session that the second Topic's Lesson fills, and undoes all of it at the end.

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

	// The Lesson editor of a Lesson in the Class's Sequence, reached from its Sequence tab.
	async function openLessonFromSequence(title: string) {
		await openFixtureClass();
		await page.getByRole('tab', { name: /^Sequence/ }).click();
		await page.getByRole('link', { name: new RegExp(title) }).click();
		await expect(page).toHaveURL(/\/lessons\//);
	}

	// A Lesson that a Sequence holds asks first, and the question names the Class.
	async function deleteLessonInSequence() {
		await page.getByRole('button', { name: 'Delete Lesson' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toContainText(`Sequence of ${FIXTURE_CLASS_LABEL}`);
		await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
		await expectToast(page, 'Lesson deleted.');
	}

	test.beforeAll(async ({ browser }) => {
		page = await openPage(browser);
		token = await standingKey(page);

		const courses = await (
			await page.request.get('/api/courses', { headers: BEARER(token) })
		).json();
		courseId = courses.find((c: { name: string }) => c.name === FIXTURE_COURSE).id;
		for (const [name, lesson] of [
			['Rewind A', 'A one'],
			['Rewind B', 'B one']
		]) {
			const topic = await post(`/api/courses/${courseId}/topics`, { name });
			topicIds.push(topic.id);
			await post(`/api/topics/${topic.id}/lessons`, { title: lesson });
		}

		await openFixtureClass();
		await page.getByRole('tab', { name: /^Sequence/ }).click();
		for (const name of ['Rewind A', 'Rewind B']) {
			await page.getByRole('button', { name: 'Assign Topic' }).click();
			await page.getByRole('menuitem', { name: new RegExp(`^${name} `) }).click();
			await expect(page.getByText(`Added 1 Lesson from ${name}.`)).toBeVisible();
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
		// 'B one' is in the Class's Sequence, so its delete asks first. The Lesson takes its entry
		// and its Teaching note with it, and the Class has no Sequence again.
		await openLessonFromSequence('B one');
		await deleteLessonInSequence();

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

	test('a Lesson removed in front of a noted Lesson moves its Teaching note to the new date', async () => {
		await openLessonFromSequence('A one');
		await deleteLessonInSequence();

		// 'B one' is now the first Session, and its note went with it.
		await openNextSession(0);
		await expect(page.locator('main')).toContainText('B one');
		await expect(page.getByLabel('How it went')).toHaveText('book the ripple tank');
		await page.getByRole('button', { name: 'Back' }).click();

		// The Slot it left is an Open Slot, which has no note field.
		await nextSessions().nth(1).getByRole('link').first().click();
		await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
		await expect(page.getByLabel('How it went')).toHaveCount(0);
	});

	test('a Lesson added in a Topic changes no date in the Class', async () => {
		await openFixtureClass();
		const before = await nextSessions().allInnerTexts();
		expect(before[0]).toContain('B one');

		await page.goto(`/courses/${courseId}?topic=${topicIds[1]}`);
		await expect(page.getByRole('link', { name: 'B one', exact: true })).toBeVisible();
		const box = page.getByPlaceholder('New Lesson title — press Enter');
		await box.fill('B extra');
		await box.press('Enter');
		await expect(page.getByRole('link', { name: 'B extra', exact: true })).toBeVisible();
		await expect(box).toBeFocused();

		// The new Lesson joins no Sequence: the Class has the same Sessions and one Lesson.
		await openFixtureClass();
		expect(await nextSessions().allInnerTexts()).toEqual(before);
		await expect(page.getByRole('tab', { name: 'Sequence 1' })).toBeVisible();
	});
});
