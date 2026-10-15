import { expect, type APIRequestContext, type Browser } from '@playwright/test';
import { BEARER, openPage, standingKey } from '../helpers.ts';

// The setup every planning API e2e file shares (issue #174): the key read from Settings and the
// small request helpers. Each file starts from resetTo('standard') and creates the records it
// reads, so each file runs alone.
export const keysOf = (body: Record<string, unknown>) => Object.keys(body).sort();

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
