import { test, expect, type Page } from '@playwright/test';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

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

	// No e2e for the extension/MIME mismatch refusal: Bun rewrites a file part's type from its
	// extension, so a browser-declared mismatch cannot reach the app — see attachments.ts.
	test('a file over the ceiling is refused', async () => {
		await attach(page, {
			name: 'big.md',
			mimeType: 'text/markdown',
			buffer: Buffer.alloc(11 * MB, 0x23)
		});

		await expectToast(page, 'Attachments are limited to 10 MB.');
		await expect(page.getByRole('dialog').getByText('big.md')).toHaveCount(0);
	});

	test('downloading an Attachment returns the original filename, identical bytes, its MIME type, and no cache headers', async () => {
		const dialog = page.getByRole('dialog');
		const link = dialog.getByRole('link', { name: 'worksheet.pdf' });
		const href = await link.getAttribute('href');

		const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);

		expect(download.suggestedFilename()).toBe('worksheet.pdf');
		const bytes = await readFile(await download.path());
		expect(bytes.equals(Buffer.alloc(14, 0x25))).toBe(true);

		// The link the download came from is the one the row shows — proves the row and the
		// served bytes agree on which Attachment this is.
		expect(href).toMatch(/^\/attachments\/[^/]+$/);

		const response = await page.request.get(href!);
		expect(response.headers()['content-type']).toBe('application/pdf');
		expect(response.headers()['cache-control']).toBeUndefined();
		expect(response.headers()['etag']).toBeUndefined();
	});

	test('a filename with accented characters downloads un-mangled', async () => {
		await attach(page, {
			name: 'café-menu.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.alloc(3, 0x2a)
		});

		const dialog = page.getByRole('dialog');
		const link = dialog.getByRole('link', { name: 'café-menu.pdf' });
		const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);

		expect(download.suggestedFilename()).toBe('café-menu.pdf');
	});

	test('a row whose file is missing on disk serves a 500 with a generic body', async () => {
		await attach(page, {
			name: 'ghost.txt',
			mimeType: 'text/plain',
			buffer: Buffer.alloc(5, 0x67)
		});

		const dialog = page.getByRole('dialog');
		const href = await dialog.getByRole('link', { name: 'ghost.txt' }).getAttribute('href');
		const id = href!.split('/').pop()!;
		await rm(join('attachments', id));

		const response = await page.request.get(href!);
		expect(response.status()).toBe(500);
		expect(await response.text()).not.toContain('ENOENT');
	});

	test('deleting an Attachment removes its row, and its link 404s afterward', async () => {
		const dialog = page.getByRole('dialog');
		const href = await dialog.getByRole('link', { name: 'field-notes.txt' }).getAttribute('href');

		await dialog.getByRole('button', { name: 'Remove field-notes.txt' }).click();
		await expect(dialog.getByText('field-notes.txt')).toHaveCount(0);

		const response = await page.request.get(href!);
		expect(response.status()).toBe(404);
	});

	test('a signed-out request to an Attachment link is redirected to /login', async ({
		browser
	}) => {
		const dialog = page.getByRole('dialog');
		const href = await dialog.getByRole('link', { name: 'worksheet.pdf' }).getAttribute('href');

		// A fresh, cookie-less context — signed-out, unlike `page` above.
		const signedOut = await browser.newContext();
		const response = await signedOut.request.get(href!);
		expect(response.url()).toContain('/login');
		await signedOut.close();
	});

	test('a traversal payload 404s rather than resolving to a real file', async () => {
		const response = await page.request.get(
			'/attachments/' + encodeURIComponent('../../package.json')
		);
		expect(response.status()).toBe(404);
	});
});
