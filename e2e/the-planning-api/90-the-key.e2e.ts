import { test, expect } from '@playwright/test';
import { BEARER, generateKey, openPage, type Page } from './helpers.ts';

// Covers regenerating the API key: the new token replaces the old, and the old stops working at
// once. Runs last in the directory, as the regeneration did in the single file this directory
// replaced, so the revocation cannot pull a key out from under the files before it.
test.describe.serial('the API key', () => {
	let page: Page;
	let token = '';

	test.beforeAll(async ({ browser }) => {
		page = await openPage(browser);
		token = await generateKey(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('regenerating the key revokes the old token at once', async ({ request }) => {
		const oldToken = token;
		token = await generateKey(page, 'Regenerate');
		expect(token).not.toBe(oldToken);

		const revoked = await request.get('/api/courses', { headers: BEARER(oldToken) });
		expect(revoked.status()).toBe(401);

		const replacement = await request.get('/api/courses', { headers: BEARER(token) });
		expect(replacement.status()).toBe(200);
	});
});
