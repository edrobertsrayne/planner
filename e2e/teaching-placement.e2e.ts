import { test, expect, type Page } from '@playwright/test';

// Covers the two doors a teacher places and removes a Lesson from (issue #254): an Open Slot's
// Session page and the Calendar day menu, plus the Calendar tile's dashed-ring mark. Runs after
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
	await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
	await expect(page.getByLabel('How it went')).toBeVisible();
}

async function expectSessionClosed(page: Page) {
	await expect(page.getByRole('button', { name: 'Back' })).toBeHidden();
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

		await page.getByRole('link', { name: '9C/Sc1 Open Slot' }).click();
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
		await expect(page.getByRole('textbox', { name: 'Lesson title' })).toHaveValue(
			'Revision session'
		);

		// A placed Standalone Lesson's plan has no editor anywhere else (ADR-0022) — this Session
		// panel is it.
		await page
			.getByRole('textbox', { name: 'Plan' })
			.fill('Revise the whole unit, past paper Q1-6.');
		await page.getByRole('textbox', { name: 'Plan' }).blur();
		await page.getByRole('radio', { name: 'Planned' }).click();
		await expect(page.getByRole('radio', { name: 'Planned' })).toHaveAttribute('data-state', 'on');

		await page.getByRole('button', { name: 'Back' }).click();
		await expectSessionClosed(page);

		await expect(cell).toContainText('9C/Sc1');
		await expect(cell).toContainText('Revision session');
		await expect(cell).toContainText('Standalone Lesson');
		await expect(cell.locator('[data-standalone-ring]')).toBeVisible();

		// Reopening reads the plan and the Planned mark back — not just the panel's own state.
		await cell.getByRole('link').click();
		await openSessionAndExpect(page);
		await expect(page.getByRole('textbox', { name: 'Plan' })).toContainText(
			'Revise the whole unit, past paper Q1-6.'
		);
		await expect(page.getByRole('radio', { name: 'Planned' })).toHaveAttribute('data-state', 'on');
		await page.getByRole('button', { name: 'Back' }).click();
		await expectSessionClosed(page);
	});

	test('opening the placed Lesson shows Standalone Lesson · Placed, and Remove placement returns the tile to an Open Slot', async () => {
		const cell = page.locator('td').filter({ hasText: '9C/Sc1' });

		await cell.getByRole('link').click();
		await openSessionAndExpect(page);
		await expect(page.getByText('Standalone Lesson · Placed')).toBeVisible();

		await page.getByRole('button', { name: 'Remove placement' }).click();
		await expect(page.getByRole('heading', { name: 'Open Slot' })).toBeVisible();

		await page.getByRole('button', { name: 'Back' }).click();
		await expectSessionClosed(page);

		await expect(page.getByRole('link', { name: '9C/Sc1 Open Slot' })).toBeVisible();
		await expect(cell.locator('[data-standalone-ring]')).toHaveCount(0);
	});

	test("placing from the Calendar day menu's Place a Lesson group lands on the Session page's Place-a-Lesson card", async () => {
		// A different week from the tile test above, so the two doors are proven independently.
		const tuesday = nextTuesday(isoDate(35));
		await page.goto(`/calendar?week=${mondayOf(tuesday)}`);

		await openDayMenu('Tue');
		await expect(page.getByRole('menuitem', { name: 'Open 9C/Sc1, P3 to place…' })).toBeVisible();
		await page.getByRole('menuitem', { name: 'Open 9C/Sc1, P3 to place…' }).click();

		await openSessionAndExpect(page);
		await expect(page.locator('main')).toContainText('9C/Sc1');
		await expect(page.getByRole('heading', { name: 'Place a Lesson' })).toBeVisible();

		// No Lesson was placed here — landing on the card is the whole of this door's contract.
		await page.getByRole('button', { name: 'Back' }).click();
		await expectSessionClosed(page);
	});

	test('a Blocked Day forces a placed Lesson off its anchor, reported by the Placements-moved alert', async () => {
		// A week not touched by any other test in this file or by teaching-flows.e2e.ts, with a
		// full week of room after it before Term 2's own end (isoDate(56)) for the shift-right
		// this test forces to land inside term.
		const tuesday = nextTuesday(isoDate(7));
		const shiftedTuesday = plusDays(tuesday, 7);

		await page.goto(`/calendar?week=${mondayOf(tuesday)}`);
		const cell = page.locator('td').filter({ hasText: '9C/Sc1' });

		await page.getByRole('link', { name: '9C/Sc1 Open Slot' }).click();
		await openSessionAndExpect(page);
		await page.getByRole('textbox', { name: 'Lesson title' }).fill('Forced-move rehearsal');
		await page.getByRole('button', { name: 'Place' }).click();
		await expect(page.getByText('Standalone Lesson · Placed')).toBeVisible();
		await page.getByRole('button', { name: 'Back' }).click();
		await expectSessionClosed(page);

		// Blocking the Placement's own day is the one input that can force it off its anchor
		// with no note to carry the report — placementsMoved exists precisely for this (ADR-0022).
		await openDayMenu('Tue');
		await page.getByRole('menuitem', { name: 'Block day' }).click();

		await expect(
			page.getByText('A Placement moved because its Slot stopped being Available.')
		).toBeVisible();
		await expect(
			page.getByText(
				new RegExp(
					`9C/Sc1 · Forced-move rehearsal — was ${tuesday} P\\d+, now ${shiftedTuesday} P\\d+`
				)
			)
		).toBeVisible();
		// A Blocked Day renders as a single "Blocked day" panel with no per-Class content — the
		// day head's own data-day-kind flips to "blocked", and the per-Class cell the Lesson sat
		// in disappears entirely, rather than a per-Class label search a whole-day block never
		// carries (and which would still pass with the Lesson left rendered).
		await expect(dayHead('Tue')).toHaveAttribute('data-day-kind', 'blocked');
		await expect(cell).toHaveCount(0);

		await page.goto(`/calendar?week=${mondayOf(shiftedTuesday)}`);
		const shiftedCell = page.locator('td').filter({ hasText: '9C/Sc1' });
		await expect(shiftedCell).toContainText('Forced-move rehearsal');
		await expect(shiftedCell.locator('[data-standalone-ring]')).toBeVisible();

		// Restore the state later files expect: unblocking returns the Slot to Available, and the
		// Placement's anchor is where it lands again (CONTEXT.md: "returns when the Slot is
		// Available again") — so removal happens back on the original Tuesday, not the shifted one.
		await page.goto(`/calendar?week=${mondayOf(tuesday)}`);
		await openDayMenu('Tue');
		await page.getByRole('menuitem', { name: 'Unblock day' }).click();

		await expect(cell).toContainText('Forced-move rehearsal');
		await cell.getByRole('link').click();
		await openSessionAndExpect(page);
		await page.getByRole('button', { name: 'Remove placement' }).click();
		await expect(page.getByRole('heading', { name: 'Open Slot' })).toBeVisible();
		await page.getByRole('button', { name: 'Back' }).click();
		await expectSessionClosed(page);
		await expect(cell.locator('[data-standalone-ring]')).toHaveCount(0);
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
