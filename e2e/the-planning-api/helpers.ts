import { expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';

// The setup every planning API e2e file shares (issue #174): the one login, the API key the
// files read from Settings, and the small request helpers. Each file starts from
// resetTo('standard') and creates the records it reads, so each file runs alone.
const EMAIL = 'teacher@example.com';
const PASSWORD = 'a-very-long-password';

// The Course and Class of the standard state. A Class follows the Course, so the delete route's
// Class refusal is reachable.
export const FIXTURE_COURSE = 'KS3 Science';
export const FIXTURE_CLASS_LABEL = '9C/Sc1';

export const BEARER = (token: string) => ({ Authorization: `Bearer ${token}` });

export const keysOf = (body: Record<string, unknown>) => Object.keys(body).sort();

async function login(page: Page, email: string, password: string) {
	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page).toHaveURL('/');
}

// Opens a page and logs the one user in — for `apiKey` and 90-the-key.e2e.ts. The resource files
// open an unauthenticated page and send the key.
export async function openPage(browser: Browser): Promise<Page> {
	const page = await browser.newPage();
	await login(page, EMAIL, PASSWORD);
	return page;
}

// Reads the standing key from the Settings card. The token is shown in full, in a read-only
// field — there is no Generate step and no one-time display to catch it from.
export async function standingKey(page: Page): Promise<string> {
	await page.goto('/settings');
	const field = page.getByLabel('API key');
	await expect(field).toBeVisible();
	return (await field.inputValue()).trim();
}

// Reads the standing key from Settings, through a page of its own. Opening Settings mints a key
// if the database has none.
export async function apiKey(browser: Browser): Promise<string> {
	const page = await openPage(browser);
	const key = await standingKey(page);
	await page.close();
	return key;
}

// Creates a record through the API and returns its id: the records a file reads, made by the file.
export async function createdId(
	request: APIRequestContext,
	token: string,
	url: string,
	data: object
) {
	const response = await request.post(url, { headers: BEARER(token), data });
	expect(response.status()).toBe(201);
	return (await response.json()).id as string;
}
