import { test, expect, type Page } from '@playwright/test';
import { expectToast, resetTo } from './helpers.ts';
import {
	BEARER,
	FIXTURE_CLASS_LABEL,
	FIXTURE_COURSE,
	openPage,
	standingKey
} from './the-planning-api/helpers.ts';

// A Lesson written in front of a noted future Session reaches the teacher as one Rewind report
// (issue #357). It gives 9C/Sc1 from the standard state (Tuesday P3, Open Slots) two Topics of
// one Lesson each in KS3 Science, notes the Session that the second Topic's Lesson fills, and
// undoes all of it at the end.

test.beforeAll(() => resetTo('standard'));

test.describe.serial('the Rewind report after a Lesson write', () => {
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

	async function openNoteOfSecondSession() {
		await openFixtureClass();
		const next = page
			.locator('section')
			.filter({ has: page.getByRole('heading', { name: 'Next Sessions' }) });
		await next.locator('li').nth(1).getByRole('link').first().click();
		const note = page.getByLabel('How it went');
		await expect(note).toBeVisible();
		return note;
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
		for (const name of ['Rewind A', 'Rewind B']) {
			await page.getByRole('button', { name: 'Assign next Topic' }).click();
			await page.getByRole('option', { name }).click();
			await expect(page.getByRole('button', { name: `Unassign ${name}` })).toBeVisible();
		}

		// The second Session the Class teaches carries 'B one'. Note it.
		const note = await openNoteOfSecondSession();
		await note.click();
		await note.pressSequentially('book the ripple tank');
		await page.getByRole('button', { name: 'Back' }).click();
	});

	test.afterAll(async () => {
		// The note goes first, so the Rewind of the unassigns sweeps the Session row away.
		const note = await openNoteOfSecondSession();
		await note.click();
		await page.keyboard.press('ControlOrMeta+a');
		await page.keyboard.press('Delete');
		await page.getByRole('button', { name: 'Back' }).click();

		await openFixtureClass();
		for (const name of ['Rewind A', 'Rewind B']) {
			await page.getByRole('button', { name: `Unassign ${name}` }).click();
			await expect(page.getByRole('button', { name: `Unassign ${name}` })).toHaveCount(0);
		}
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

	async function openTopic() {
		await page.goto(`/courses/${courseId}?topic=${topicIds[0]}`);
		await expect(page.getByRole('link', { name: 'A one', exact: true })).toBeVisible();
	}

	test('adding a Lesson in front of a noted Session shows the report', async () => {
		await openTopic();
		const box = page.getByPlaceholder('New Lesson title — press Enter');
		await box.fill('A extra');
		await box.press('Enter');

		await expect(page.getByText(/The Rewind changed the Lesson on .* noted Session/)).toBeVisible();
		await expect(
			page.getByText(new RegExp(`${FIXTURE_CLASS_LABEL} · .* P\\d — now B one`))
		).toBeVisible();
		await expect(box).toBeFocused();
	});

	test('moving a Lesson in front of a noted Session shows the report', async () => {
		await openTopic();
		await expect(page.getByText('The Rewind changed the Lesson')).toHaveCount(0);
		await page.getByRole('button', { name: 'Move A extra up' }).click();

		await expect(page.getByText(/The Rewind changed the Lesson on .* noted Session/)).toBeVisible();
	});

	test('deleting a Lesson in front of a noted Session shows the report', async () => {
		await openTopic();
		await page.getByRole('link', { name: 'A extra', exact: true }).click();
		await page.getByRole('button', { name: 'Delete Lesson' }).click();

		await expectToast(page, 'The Rewind changed the Lesson on');
	});
});
