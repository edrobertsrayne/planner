import { expect, type Browser, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

// The setup every planning API e2e file shares (issue #174): the one login, the API key the
// files read from Settings, and the small request, date and fixture helpers the resource files
// use. The files run one at a time in the suite's single-worker ordering (see isolation.e2e.ts),
// so the numbered prefixes carry the order the sections read in the single file they replaced:
// Courses, Topics, Lessons, Links, the Import, the refusals that read what those left behind,
// the Blocked Days, the Terms, and the key regeneration last. The directory sits where that
// single file sat — after teaching-flows.e2e.ts, whose Classes the fixtures assign — and before
// user-settings-password.e2e.ts, which must stay last.
//
// The key is stable across files (issue #183): opening Settings mints one if the database has
// none, so from 10-courses.e2e.ts on every file reads the same standing token. Only
// 90-the-key.e2e.ts, which runs last, is allowed to replace it — that is the regeneration test.
const EMAIL = 'teacher@example.com';
const PASSWORD = 'a-very-long-password';

// The Course the wizard-era fixture data left behind: two Classes follow it (created in
// teaching-flows.e2e.ts), which is what makes the delete route's Class refusal reachable.
export const FIXTURE_COURSE = 'KS3 Science';
export const FIXTURE_CLASS_LABEL = '9C/Sc1';

export const BEARER = (token: string) => ({ Authorization: `Bearer ${token}` });

export const keysOf = (body: Record<string, unknown>) => Object.keys(body).sort();

export function plusDays(iso: string, days: number): string {
	const date = new Date(`${iso}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

function weekdayOf(iso: string): number {
	return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

// The next Monday-to-Friday date on or after `iso`.
export function nextWeekday(iso: string): string {
	let date = iso;
	while (weekdayOf(date) === 0 || weekdayOf(date) === 6) date = plusDays(date, 1);
	return date;
}

// The next Saturday on or after `iso`.
export function nextSaturday(iso: string): string {
	let date = iso;
	while (weekdayOf(date) !== 6) date = plusDays(date, 1);
	return date;
}

export function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

export function runFixture(...args: string[]): string {
	return execFileSync('node', ['scripts/e2e-fixtures.ts', ...args], {
		cwd: process.cwd(),
		env: { ...process.env, DATABASE_URL: 'e2e.db' },
		encoding: 'utf-8'
	});
}

async function login(page: Page, email: string, password: string) {
	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page).toHaveURL('/');
}

// Opens a page and logs the one user in — the first step of every file's setup.
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
