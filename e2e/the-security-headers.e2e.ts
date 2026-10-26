import { test, expect, type APIResponse } from '@playwright/test';
import { login, resetTo, runFixture } from './helpers.ts';

test.beforeAll(() => resetTo('standard'));

// Every response carries these three (#431): a download is never sniffed into another type, a link
// out leaks no address, and no page can be framed. Only the running app can show what a download
// and an API-less route actually send.
const HEADERS = {
	'x-content-type-options': 'nosniff',
	'referrer-policy': 'same-origin',
	'content-security-policy': "frame-ancestors 'none'"
};

function expectHeaders(response: APIResponse) {
	for (const [name, value] of Object.entries(HEADERS)) {
		expect(response.headers()[name], name).toBe(value);
	}
}

test('a page, an Attachment download and a Backup download all carry them', async ({ page }) => {
	await login(page);

	const lessonId = runFixture('find-lesson-id', 'Speed').trim();
	runFixture('add-attachment', lessonId, 'worksheet.pdf', 'application/pdf', 'hello');

	expectHeaders(await page.request.get('/'));

	await page.goto(`/lessons/${lessonId}`);
	const href = await page.getByRole('link', { name: 'worksheet.pdf' }).getAttribute('href');
	expectHeaders(await page.request.get(href!));

	expectHeaders(await page.request.get('/backup'));
});

test('robots.txt turns every crawler away', async ({ page }) => {
	await login(page);
	const response = await page.request.get('/robots.txt');
	expect(await response.text()).toContain('Disallow: /');
});
