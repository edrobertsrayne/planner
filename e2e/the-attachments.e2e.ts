import { test, expect, type Page } from '@playwright/test';

// Runs after teaching-flows.e2e.ts — the one user and the KS3 Science course already exist —
// and before the-calendar-setup.e2e.ts, for the suite's single-worker ordering (see
// isolation.e2e.ts). Adds its own Topic and Lesson, so no earlier fixture changes.
const EMAIL = 'teacher@example.com';
const PASSWORD = 'a-very-long-password';

const MB = 1024 * 1024;

async function login(page: Page, email: string, password: string) {
	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page).toHaveURL('/');
}

// The driver supplies the file the native picker would: setting files on the hidden input
// fires its change, and the upload submits at once.
async function attach(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
	await page.getByRole('dialog').getByLabel('Choose a file to attach').setInputFiles(file);
}

// A refusal rides the app's toast convention; an older toast may still be on screen, so the
// reason is matched rather than any toast.
async function expectToast(page: Page, fragment: string) {
	await expect(page.locator('[data-sonner-toast]').filter({ hasText: fragment })).toBeVisible();
}

test.describe.serial('Attachments on Lessons', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await login(page, EMAIL, PASSWORD);

		// A Topic and a Lesson of this spec's own, so the Attachments section starts empty and
		// no earlier fixture is touched.
		await page.goto('/courses');
		await page.getByRole('link', { name: 'KS3 Science' }).click();
		await page.getByPlaceholder('New Topic name — press Enter').fill('Materials');
		await page.getByPlaceholder('New Topic name — press Enter').press('Enter');
		await page.getByPlaceholder('New Lesson title — press Enter').fill('Glaciers');
		await page.getByPlaceholder('New Lesson title — press Enter').press('Enter');
		await expect(page.getByRole('link', { name: 'Glaciers', exact: true })).toBeVisible();
		await page.getByRole('link', { name: 'Glaciers', exact: true }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
	});

	test('choosing a file through "+ Add Attachment" uploads it and the row appears', async () => {
		await attach(page, {
			name: 'worksheet.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.alloc(14, 0x25)
		});

		const dialog = page.getByRole('dialog');
		await expect(dialog.getByText('worksheet.pdf')).toBeVisible();
		await expect(dialog.getByText('14 B', { exact: true })).toBeVisible();
	});

	test('a new Attachment appends at the end, and a file over the framework default body limit uploads cleanly', async () => {
		// 1 MiB — twice the framework's default form-action body limit (512K), far under the
		// app's own 10 MiB ceiling, so the raised limit is exercised through the whole stack.
		await attach(page, {
			name: 'field-notes.txt',
			mimeType: 'text/plain',
			buffer: Buffer.alloc(MB, 0x61)
		});

		const dialog = page.getByRole('dialog');
		await expect(dialog.getByText('field-notes.txt')).toBeVisible();
		await expect(dialog.getByText('1.0 MB', { exact: true })).toBeVisible();

		// Position order: the new row sits below the first, whatever a filename sort would say.
		const firstY = (await dialog.getByText('worksheet.pdf').boundingBox())!.y;
		const secondY = (await dialog.getByText('field-notes.txt').boundingBox())!.y;
		expect(secondY).toBeGreaterThan(firstY);
	});

	test('a disallowed type is refused with a readable toast and leaves the section unchanged', async () => {
		await attach(page, {
			name: 'virus.exe',
			mimeType: 'application/x-msdownload',
			buffer: Buffer.from('MZ')
		});

		await expectToast(page, 'virus.exe" is not a supported file type');
		await expect(page.getByRole('dialog').getByText('virus.exe')).toHaveCount(0);
		await expect(page.getByRole('dialog').getByText('worksheet.pdf')).toBeVisible();
		await expect(page.getByRole('dialog').getByText('field-notes.txt')).toBeVisible();
	});

	// The extension/MIME disagreement refusal has no e2e: Bun's form-data parser rewrites a file
	// part's type from its filename extension before the action reads it, so a browser-declared
	// mismatch cannot reach the app. The refusal is a pure check, proven directly at the unit
	// seam (attachments.test.ts).
	test('a file over the ceiling is refused', async () => {
		await attach(page, {
			name: 'big.md',
			mimeType: 'text/markdown',
			buffer: Buffer.alloc(11 * MB, 0x23)
		});

		await expectToast(page, 'Attachments are limited to 10 MB.');
		await expect(page.getByRole('dialog').getByText('big.md')).toHaveCount(0);
	});
});
