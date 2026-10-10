import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

// Helpers the e2e files share. Not a test file: `testMatch` in playwright.config.ts only takes
// `*.e2e.ts`. Import from here before writing a local copy.
export const EMAIL = 'teacher@example.com';
export const PASSWORD = 'a-very-long-password';

// A scratch database, never the developer's own local.db (see issue #40), and the server's
// address. playwright.config.ts deletes the database before every run, so the suite starts with
// migrations applied and no user.
export const DATABASE_URL = 'e2e.db';
export const ORIGIN = 'http://localhost:4173';

// The form login runs once after each reset. Later tests reuse its session cookies, so each test
// opens its page at once. sign-in-out.e2e.ts tests the form itself. If the stored session no
// longer works (the guard sends the page to /login), the form runs again.
let session: Awaited<ReturnType<BrowserContext['cookies']>> | undefined;

export async function login(page: Page, path = '/') {
	if (session) {
		await page.context().addCookies(session);
		await page.goto(path);
		if (new URL(page.url()).pathname !== '/login') return;
	}
	await page.goto('/login');
	await page.getByLabel('Email').fill(EMAIL);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page).toHaveURL('/');
	session = await page.context().cookies();
	if (path !== '/') await page.goto(path);
}

// Clears e2e.db and its Attachments, then writes one known state, so a file runs alone or in
// any order. Each e2e file calls this first, in a top-level beforeAll. 'empty' has no user (the
// first-run wizard). 'standard' is the user, six Terms, KS3 Science > Forces > Speed, Motion,
// 9B/Sc1 and 9C/Sc1 with Slots, and one past Session (see `reset` in scripts/e2e-fixtures.ts).
export function resetTo(state: 'empty' | 'standard') {
	runFixture('reset', state, ORIGIN);
	session = undefined;
}

export function runFixture(...args: string[]): string {
	return execFileSync('bun', ['scripts/e2e-fixtures.ts', ...args], {
		cwd: process.cwd(),
		env: { ...process.env, DATABASE_URL },
		encoding: 'utf-8'
	});
}

export function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

// Today plus `offsetDays`, as an ISO date.
export function isoDate(offsetDays: number): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + offsetDays);
	return d.toISOString().slice(0, 10);
}

export function plusDays(iso: string, days: number): string {
	const date = new Date(`${iso}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

export function weekdayOf(iso: string): number {
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

// The Monday of the ISO week `iso` falls in, from whichever day getUTCDay() reports.
export function mondayOf(iso: string): string {
	return plusDays(iso, -((weekdayOf(iso) + 6) % 7));
}

// The box a control gives a touch: its drawn box, and the larger of that and its invisible
// 44 px ::after (see touch-target.ts, which buttons carry; an input instead grows to min-h-11
// on touch). A checkbox is tapped through the label that wraps it (ready-tick.svelte), so that
// label is its hit area.
export async function expectBox44(control: Locator, wrapped = false) {
	const box = await control.evaluate((el, wrapped) => {
		const target = wrapped ? (el.closest('label') ?? el) : el;
		const after = (node: Element, side: 'width' | 'height') =>
			parseFloat(getComputedStyle(node, '::after')[side]) || 0;
		const rect = target.getBoundingClientRect();
		return {
			width: Math.max(rect.width, after(target, 'width')),
			height: Math.max(rect.height, after(target, 'height'))
		};
	}, wrapped);
	expect(box.width).toBeGreaterThanOrEqual(44);
	expect(box.height).toBeGreaterThanOrEqual(44);
}

export async function expectHitArea44(
	page: Page,
	name: string | RegExp,
	role: 'button' | 'link' | 'checkbox' | 'tab'
) {
	await expectBox44(page.getByRole(role, { name }).first(), role === 'checkbox');
}

export async function expectNoHorizontalScroll(page: Page) {
	const fits = await page.evaluate(
		() => document.documentElement.scrollWidth <= document.documentElement.clientWidth
	);
	expect(fits).toBe(true);
}

// A refusal rides the app's toast convention; an older toast may still be on screen, so the
// reason is matched rather than any toast.
export async function expectToast(page: Page, fragment: string) {
	await expect(page.locator('[data-sonner-toast]').filter({ hasText: fragment })).toBeVisible();
}

export async function openCourse(page: Page) {
	await login(page, '/courses');
	await page.getByRole('link', { name: 'KS3 Science' }).click();
}

// The Lesson editor shows its title as a field on a laptop or tablet, and as a heading on a phone.
export async function expectLessonPage(page: Page) {
	await expect(page).toHaveURL(/\/lessons\//);
	await expect(
		page.getByRole('textbox', { name: 'Lesson title' }).or(page.getByRole('heading', { level: 1 }))
	).toBeVisible();
}

// The Lesson editor of Speed by its address: the Courses screen is not usable at every size yet.
export async function openLesson(page: Page) {
	await login(page, `/lessons/${runFixture('find-lesson-id', 'Speed').trim()}`);
	await expectLessonPage(page);
}

// The Lesson editor of Speed, opened from the Courses screen as Ed opens it.
export async function openLessonFromCourses(page: Page) {
	await openCourse(page);
	await page.getByRole('link', { name: 'Forces' }).click();
	await page.getByRole('link', { name: 'Speed', exact: true }).click();
	await expectLessonPage(page);
}

// A Session page with a Lesson, opened from the first Agenda row that carries one, the way the
// teacher opens it. Returns the address, so a test can reload it or open it directly.
export async function openSessionWithLesson(page: Page): Promise<string> {
	await login(page);
	const row = page
		.locator('li')
		.filter({ has: page.locator('a[href^="/sessions/"]') })
		.filter({ hasNotText: 'Open Slot' })
		.first();
	await row.locator('a[href^="/sessions/"]').first().click();
	await expect(page.getByLabel('How it went')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Open in Lesson editor' })).toBeVisible();
	return new URL(page.url()).pathname;
}
