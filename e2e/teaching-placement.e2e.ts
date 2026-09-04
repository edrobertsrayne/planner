import { test, expect, type Page } from '@playwright/test';

// Covers the two doors a teacher places and removes a Lesson from (issue #254): an Open Slot's
// Session panel and the Calendar day menu, plus the Calendar tile's dashed-ring mark. Runs after
// teaching-flows.e2e.ts — the one user, the Terms and 9C/Sc1 (which never gets a Topic assigned,
// so its Tuesday P3 Slot in every week stays an Open Slot) already exist — and before
// the-attachments.e2e.ts, for the suite's single-worker ordering (see isolation.e2e.ts). Every
// date here is chosen well clear of the dates teaching-flows.e2e.ts itself acts on, so this file
// disturbs nothing the files after it depend on.
const EMAIL = 'teacher@example.com';
const PASSWORD = 'a-very-long-password';

function isoDate(offsetDays: number): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + offsetDays);
	return d.toISOString().slice(0, 10);
}

function plusDays(iso: string, days: number): string {
	const date = new Date(`${iso}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

function weekdayOf(iso: string): number {
	return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

// The next Tuesday on or after `iso` — 9C/Sc1's one weekly Slot, in every Teaching Week letter.
function nextTuesday(iso: string): string {
	let date = iso;
	while (weekdayOf(date) !== 2) date = plusDays(date, 1);
	return date;
}

function mondayOf(iso: string): string {
	return plusDays(iso, -((weekdayOf(iso) + 6) % 7));
}

async function login(page: Page, email: string, password: string) {
	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page).toHaveURL('/');
}

async function openSessionAndExpect(page: Page) {
	await expect(page.getByRole('button', { name: 'Close Session' })).toBeVisible();
	await expect(page.getByLabel('How it went')).toBeVisible();
}

async function expectSessionClosed(page: Page) {
	await expect(page.getByRole('button', { name: 'Close Session' })).toBeHidden();
}

test.describe.serial('Placing and removing a Lesson', () => {
	let page: Page;

	// One day's head cell, where its menu button lives — the same helper the-calendar-setup.e2e.ts
	// uses for the day menu.
	function dayHead(day: string) {
		return page.locator('thead th').filter({ hasText: day });
	}

	async function openDayMenu(day: string) {
		await dayHead(day)
			.getByRole('button', { name: /actions$/ })
			.click();
	}

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await login(page, EMAIL, PASSWORD);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('placing a Lesson from an Open Slot tile creates it and marks the tile with its dashed ring', async () => {
		// Three weeks out — well inside Term 2 (isoDate(-14) to isoDate(56) per teaching-flows'
		// fixture) and well clear of the dates teaching-flows' own tests act on.
		const tuesday = nextTuesday(isoDate(21));
		await page.goto(`/calendar?week=${mondayOf(tuesday)}`);
		const cell = page.locator('td').filter({ hasText: '9C/Sc1' });

		await page.getByRole('button', { name: '9C/Sc1 Open Slot' }).click();
		await openSessionAndExpect(page);
		await expect(page.getByRole('heading', { name: 'Place a Lesson' })).toBeVisible();
		await expect(
			page.getByText(
				"A Lesson with no Topic, scheduled directly on this occasion. It will not be part of 9C/Sc1's Course sequence."
			)
		).toBeVisible();

		await page.getByRole('textbox', { name: 'Lesson title' }).fill('Revision session');
		await page.getByRole('button', { name: 'Place' }).click();

		await expect(page.getByText('Standalone Lesson · Placed')).toBeVisible();
		await expect(page.locator('[data-session-panel]')).toContainText('Revision session');

		await page.keyboard.press('Escape');
		await expectSessionClosed(page);

		await expect(cell).toContainText('9C/Sc1');
		await expect(cell).toContainText('Revision session');
		await expect(cell).toContainText('Standalone Lesson');
		await expect(cell.locator('[data-standalone-ring]')).toBeVisible();
	});

	test('opening the placed Lesson shows Standalone Lesson · Placed, and Remove placement returns the tile to an Open Slot', async () => {
		const cell = page.locator('td').filter({ hasText: '9C/Sc1' });

		await cell.getByRole('button').click();
		await openSessionAndExpect(page);
		await expect(page.getByText('Standalone Lesson · Placed')).toBeVisible();

		await page.getByRole('button', { name: 'Remove placement' }).click();
		await expect(page.getByRole('heading', { name: 'Open Slot' })).toBeVisible();

		await page.keyboard.press('Escape');
		await expectSessionClosed(page);

		await expect(page.getByRole('button', { name: '9C/Sc1 Open Slot' })).toBeVisible();
		await expect(cell.locator('[data-standalone-ring]')).toHaveCount(0);
	});

	test("placing from the Calendar day menu's Place a Lesson group lands on the Session panel's Place-a-Lesson card", async () => {
		// A different week from the tile test above, so the two doors are proven independently.
		const tuesday = nextTuesday(isoDate(35));
		await page.goto(`/calendar?week=${mondayOf(tuesday)}`);

		await openDayMenu('Tue');
		await expect(page.getByRole('menuitem', { name: 'Open 9C/Sc1, P3 to place…' })).toBeVisible();
		await page.getByRole('menuitem', { name: 'Open 9C/Sc1, P3 to place…' }).click();

		await openSessionAndExpect(page);
		await expect(page.locator('[data-session-panel]')).toContainText('9C/Sc1');
		await expect(page.getByRole('heading', { name: 'Place a Lesson' })).toBeVisible();

		// No Lesson was placed here — landing on the card is the whole of this door's contract.
		await page.keyboard.press('Escape');
		await expectSessionClosed(page);
	});

	test('a day menu for a past week shows no Place a Lesson lines', async () => {
		// Well inside Term 1 (isoDate(-84) to isoDate(-21)) — a real teaching week, wholly in the
		// past. Placing is future-and-today only (unlike Blocking, which stays reachable after the
		// fact); this is the one rule under test, so the day menu opening at all — its "Block day"
		// line is date-independent — is what proves this is the same menu, just missing the group.
		const tuesday = nextTuesday(isoDate(-30));
		await page.goto(`/calendar?week=${mondayOf(tuesday)}`);

		await openDayMenu('Tue');
		await expect(page.getByRole('menuitem', { name: 'Block day' })).toBeVisible();
		await expect(page.getByText('Place a Lesson', { exact: true })).toBeHidden();
		await expect(page.getByRole('menuitem', { name: /to place…$/ })).toHaveCount(0);
		await page.keyboard.press('Escape');
	});
});
