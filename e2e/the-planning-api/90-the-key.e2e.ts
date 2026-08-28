import { test, expect } from '@playwright/test';
import { BEARER, standingKey, openPage, type Page } from './helpers.ts';

// Covers regenerating the API key: the new token replaces the old, and the old stops working at
// once. Runs last in the directory, as the regeneration did in the single file this directory
// replaced, so the revocation cannot pull the key out from under the files before it. It is the
// one file allowed to replace the standing key the others read (see helpers.ts).
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

	test('regenerating the key revokes the old token at once', async ({ request }) => {
		const oldToken = token;
		await page.getByRole('button', { name: 'Regenerate' }).click();
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
