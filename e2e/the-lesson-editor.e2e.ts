import { test, expect } from '@playwright/test';
import { expectLessonPage, login, resetTo, runFixture } from './helpers.ts';

// The Lesson editor's Sequence-aware controls (ADR-0026): Delete asks when a Class's Sequence
// holds the Lesson, and a Standalone Lesson is filed in a Topic from the picker. Reads the
// standard state. The Delete test adds its own Lesson at the end of 9B/Sc1's Sequence: Motion is
// Fixed on a day 9B/Sc1 has a Slot, and a Fixed Lesson refuses delete before it asks.

test.beforeAll(() => resetTo('standard'));

test.describe('the Lesson editor and Sequences', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('Delete Lesson on a Lesson a Sequence holds names the Class, and Cancel keeps it', async ({
		page
	}) => {
		const id = runFixture('add-lesson', '9B/Sc1', 'Delete target').trim();
		await login(page, `/lessons/${id}`);
		await expectLessonPage(page);

		await page.getByRole('button', { name: 'Delete Lesson' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toContainText('9B/Sc1');

		await dialog.getByRole('button', { name: 'Cancel' }).click();
		await expect(dialog).toHaveCount(0);
		await expect(page).toHaveURL(`/lessons/${id}`);

		await page.getByRole('button', { name: 'Delete Lesson' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
		await expect(page).not.toHaveURL(/\/lessons\//);
		const gone = await page.goto(`/lessons/${id}`);
		expect(gone?.status()).toBe(404);
	});

	test('the Choose a Topic… picker files a Standalone Lesson in a Topic', async ({ page }) => {
		const id = runFixture('create-standalone-lesson', 'Picker carousel').trim();
		await login(page, `/lessons/${id}`);
		await expectLessonPage(page);

		const picker = page.getByLabel('Topic', { exact: true });
		await expect(picker).toHaveValue('');
		await picker.selectOption({ label: 'Forces' });

		// Filed: the Topic is now a field with a Course breadcrumb, and the picker is gone.
		await expect(page.getByRole('link', { name: /KS3 Science/ })).toContainText('Forces');
		await expect(page.getByText('Standalone Lesson', { exact: true })).toHaveCount(0);
		await expect(page.getByText(/^Lesson \d+ of \d+$/)).toBeVisible();
	});
});

// #422: a plan typed with no blur, and a tab reloaded mid-sentence, both keep their words.
test.describe('the Lesson editor saving a plan without a blur', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	const planOf = (page: import('@playwright/test').Page) =>
		page.getByRole('textbox', { name: 'Notes & objectives' });
	const bodyOf = (page: import('@playwright/test').Page) =>
		page.locator('#lesson-form [name="body"]');

	async function openBlank(page: import('@playwright/test').Page, title: string) {
		const id = runFixture('create-standalone-lesson', title).trim();
		await login(page, `/lessons/${id}`);
		await expectLessonPage(page);
		return id;
	}

	async function deleteLesson(page: import('@playwright/test').Page) {
		await page.getByRole('button', { name: 'Delete Lesson' }).click();
		await expect(page).not.toHaveURL(/\/lessons\//);
	}

	test('a plan typed and left alone is saved once typing pauses', async ({ page }) => {
		await openBlank(page, 'Debounced plan');
		const saved = page.waitForResponse((response) => response.url().includes('updateLesson'));
		await planOf(page).click();
		await page.keyboard.insertText('Cells and batteries');
		await saved;

		await page.reload();
		await expectLessonPage(page);
		await expect(bodyOf(page)).toHaveValue('Cells and batteries');
		await deleteLesson(page);
	});

	test('a plan reloaded at once is flushed as the page unloads', async ({ page }) => {
		await openBlank(page, 'Flushed plan');
		await planOf(page).click();
		await page.keyboard.insertText('Past papers');
		await page.reload();

		await expectLessonPage(page);
		await expect(bodyOf(page)).toHaveValue('Past papers');
		await deleteLesson(page);
	});
});
