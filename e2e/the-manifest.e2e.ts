import { test, expect } from '@playwright/test';
import { resetTo } from './helpers.ts';

test.beforeAll(() => resetTo('empty'));

// Static files are served before the hooks run, so a signed-out phone can still fetch the manifest
// and every icon it names (#437).
test('the manifest and its icons answer 200 with no session', async ({ page }) => {
	const manifest = await page.request.get('/manifest.webmanifest');
	expect(manifest.status()).toBe(200);
	const body = await manifest.json();
	expect(body).toMatchObject({
		name: 'Planner',
		short_name: 'Planner',
		start_url: '/',
		display: 'standalone'
	});

	for (const icon of body.icons as { src: string }[]) {
		expect((await page.request.get(icon.src)).status(), icon.src).toBe(200);
	}
	expect((await page.request.get('/apple-touch-icon.png')).status()).toBe(200);
});

test('Chrome reads the manifest with no errors and reports the app installable', async ({
	page
}) => {
	await page.goto('/setup');
	const client = await page.context().newCDPSession(page);

	const manifest = await client.send('Page.getAppManifest');
	expect(manifest.errors).toEqual([]);
	expect(manifest.data).toContain('"Planner"');

	// Chrome will not install from an incognito profile, which is what Playwright gives every
	// test; that is the only complaint allowed, so any real one still fails the test.
	const installability = await client.send('Page.getInstallabilityErrors');
	expect(
		installability.installabilityErrors.filter((error) => error.errorId !== 'in-incognito')
	).toEqual([]);
});
