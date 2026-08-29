import { test, expect, type Page } from '@playwright/test';
import { BEARER, standingKey, openPage } from './helpers.ts';

// Covers the API key card's two controls — Copy, and Regenerate behind its confirmation (issue
// #184): copy puts the exact token on the clipboard, cancelling the confirmation leaves the key
// untouched, and confirming replaces it. The replace runs last, as the regeneration did in the
// single file this directory replaced, so the revocation cannot pull the key out from under the
// files before it. It is the one file allowed to replace the standing key the others read (see
// helpers.ts).
test.describe.serial('the API key', () => {
	let page: Page;
	let token = '';

	test.beforeAll(async ({ browser }) => {
		page = await openPage(browser);
		token = await standingKey(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('copying the key puts the exact token on the clipboard and confirms it', async () => {
		// Reading the clipboard back needs the permissions granted to this origin.
		await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
			origin: new URL(page.url()).origin
		});

		await page.getByRole('button', { name: 'Copy key' }).click();

		await expect(page.getByRole('status').filter({ hasText: 'API key copied.' })).toBeVisible();
		const clipboard = await page.evaluate(() => navigator.clipboard.readText());
		expect(clipboard).toBe(token);
	});

	test('cancelling the confirmation leaves the key untouched', async () => {
		await page.getByRole('button', { name: 'Regenerate key' }).click();

		await expect(page.getByRole('dialog')).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Regenerate the API key?' })).toBeVisible();

		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect(page.getByRole('dialog')).not.toBeVisible();
		await expect(page.getByLabel('API key')).toHaveValue(token);
	});

	test('confirming the regeneration revokes the old token at once', async ({ request }) => {
		const oldToken = token;
		await page.getByRole('button', { name: 'Regenerate key' }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await page.getByRole('button', { name: 'Regenerate', exact: true }).click();

		await expect(
			page.getByRole('status').filter({ hasText: 'API key regenerated.' })
		).toBeVisible();
		token = await standingKey(page);
		expect(token).not.toBe(oldToken);

		const revoked = await request.get('/api/courses', { headers: BEARER(oldToken) });
		expect(revoked.status()).toBe(401);

		const replacement = await request.get('/api/courses', { headers: BEARER(token) });
		expect(replacement.status()).toBe(200);
	});
});
