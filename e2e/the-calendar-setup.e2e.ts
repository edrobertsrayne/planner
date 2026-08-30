import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

// Covers the Calendar's setup mode (issue #166): opening it, the six fixed Term rows, the live
// preview, saving through the Terms seam, Cancel, and the empty planner opening it by itself.
// Runs after teaching-flows.e2e.ts, whose set-terms fixture gives the mode a saved year to edit,
// and before the-planning-api/ (the planning API files), which need no Terms — so ending with the
// year cleared disturbs nothing that runs later.
const EMAIL = 'teacher@example.com';
const PASSWORD = 'a-very-long-password';

const TERM_NAMES = ['Autumn 1', 'Autumn 2', 'Spring 1', 'Spring 2', 'Summer 1', 'Summer 2'];

function runFixture(...args: string[]): string {
	return execFileSync('node', ['scripts/e2e-fixtures.ts', ...args], {
		cwd: process.cwd(),
		env: { ...process.env, DATABASE_URL: 'e2e.db' },
		encoding: 'utf-8'
	});
}

function plusDays(iso: string, days: number): string {
	const date = new Date(`${iso}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

function weekdayOf(iso: string): number {
	return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

// The next Monday-to-Friday date on or after `iso`.
function nextWeekday(iso: string): string {
	let date = iso;
	while (weekdayOf(date) === 0 || weekdayOf(date) === 6) date = plusDays(date, 1);
	return date;
}

// The next Saturday on or after `iso`.
function nextSaturday(iso: string): string {
	let date = iso;
	while (weekdayOf(date) !== 6) date = plusDays(date, 1);
	return date;
}

function shortDate(iso: string): string {
	return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

async function login(page: Page, email: string, password: string) {
	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page).toHaveURL('/');
}

test.describe.serial('the Calendar setup mode', () => {
	let page: Page;

	// Opens one day's menu, the way the teacher does: the quiet button in its head.
	async function openDayMenu(day: string) {
		await page
			.locator('thead th')
			.filter({ hasText: day })
			.getByRole('button', { name: /actions$/ })
			.click();
	}

	// Blocks one day through its own day head menu: one click, no note, because a Blocked Day
	// records no cause.
	async function blockDayFromHeader(day: string) {
		await openDayMenu(day);
		await page.getByRole('menuitem', { name: 'Block day' }).click();
	}

	// Unblocks one day through its own day head menu.
	async function unblockDayFromHeader(day: string) {
		await openDayMenu(day);
		await page.getByRole('menuitem', { name: 'Unblock day' }).click();
	}

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await login(page, EMAIL, PASSWORD);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('Set up year replaces the week grid in place with six fixed Terms', async () => {
		await page.goto('/calendar');
		await expect(page.getByRole('button', { name: 'Set up year' })).toBeVisible();

		await page.getByRole('button', { name: 'Set up year' }).click();

		// The same route, the grid replaced: the six Terms as fixed rows, an opening and a
		// closing per row, and no way to add or remove one.
		expect(page.url()).toMatch(/\/calendar$/);
		await expect(page.getByRole('button', { name: 'Set up year' })).toBeHidden();
		await expect(page.getByRole('button', { name: 'Save year' })).toBeVisible();
		for (const name of TERM_NAMES) {
			// The name is shown and cannot be edited — it is a cell, not a field, and the row's
			// inputs are its dates alone.
			await expect(page.locator('[data-term-rows]').getByText(name, { exact: true })).toBeVisible();
			await expect(page.getByLabel(`${name} opening date`)).toBeVisible();
			await expect(page.getByLabel(`${name} closing date`)).toBeVisible();
		}
		await expect(page.locator('[data-term-rows] input[type="date"]')).toHaveCount(12);

		// The week controls the setup replaces are gone while it is open.
		await expect(page.getByLabel('Previous Teaching Week')).toHaveCount(0);
	});

	test('the preview updates as a Term date is typed, before saving', async () => {
		const rows = page.locator('[data-week-preview] tbody tr');
		const savedCloses = await page.getByLabel('Summer 2 closing date').inputValue();
		const weeksBefore = await rows.count();

		// Four more Mondays in the year — the preview moves as the date is typed, and moves back
		// when the date does. Nothing has been saved at any point.
		await page.getByLabel('Summer 2 closing date').fill(plusDays(savedCloses, 28));
		await expect(rows).toHaveCount(weeksBefore + 4);

		await page.getByLabel('Summer 2 closing date').fill(savedCloses);
		await expect(rows).toHaveCount(weeksBefore);
	});

	test('a refusal from the seam is shown to the teacher and saves nothing', async () => {
		const savedCloses = await page.getByLabel('Spring 2 closing date').inputValue();

		await page.getByLabel('Spring 2 closing date').fill('');
		await page.getByRole('button', { name: 'Save year' }).click();

		await expect(page.getByRole('alert').filter({ hasText: 'is not a real date.' })).toBeVisible();

		// Still in setup mode, still nothing applied.
		await expect(page.getByRole('button', { name: 'Save year' })).toBeVisible();

		await page.getByLabel('Spring 2 closing date').fill(savedCloses);
		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect(page.getByRole('button', { name: 'Set up year' })).toBeVisible();
	});

	test('saving applies the six Terms all at once and reports plainly when nothing was put at risk', async () => {
		await page.getByRole('button', { name: 'Set up year' }).click();

		// Extend the year by four weeks, this time for real.
		const savedCloses = await page.getByLabel('Summer 2 closing date').inputValue();
		await page.getByLabel('Summer 2 closing date').fill(plusDays(savedCloses, 28));
		await page.getByRole('button', { name: 'Save year' }).click();

		// Back on the week grid, with the empty at-risk report said plainly rather than left to
		// read as silence.
		await expect(page.getByText('The year is saved. No Sessions were put at risk.')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Set up year' })).toBeVisible();
		await expect(page.locator('[data-week-preview]')).toHaveCount(0);

		// The saved year is the extended one: reopening setup shows the applied dates.
		await page.getByRole('button', { name: 'Set up year' }).click();
		await expect(page.getByLabel('Summer 2 closing date')).toHaveValue(plusDays(savedCloses, 28));
		await page.getByRole('button', { name: 'Cancel' }).click();
	});

	test('a Blocked Day is added from setup mode, refused where the date cannot be one, and removed', async () => {
		await page.getByRole('button', { name: 'Set up year' }).click();

		// A weekday inside the second Term, with no Session noted on it — so adding it says
		// plainly that nothing was put at risk, and the week it falls in loses a teaching day.
		// Holds on any real-world day the suite runs on: nextWeekday absorbs a Saturday or Sunday
		// "today" by stepping forward at most two days, and the second Term (isoDate(-14) to
		// isoDate(56) in teaching-flows.e2e.ts) is wide enough around day 40 to swallow that step.
		const inset = nextWeekday(plusDays(new Date().toISOString().slice(0, 10), 40));
		const insetMonday = plusDays(inset, -((weekdayOf(inset) + 6) % 7));
		const insetWeek = page
			.locator('[data-week-preview] tbody tr')
			.filter({ hasText: shortDate(insetMonday) });
		const daysBefore = Number(await insetWeek.locator('td').last().innerText());

		await page.getByLabel('Blocked Day date').fill(inset);
		await page.getByLabel('Blocked Day note').fill('INSET day');
		await page.getByRole('button', { name: 'Add day' }).click();

		await expect(
			page.locator('section:has([data-blocked-days])').getByRole('status')
		).toBeVisible();
		await expect(page.getByLabel(`Remove Blocked Day ${inset}`)).toBeVisible();
		await expect(insetWeek.locator('td').last()).toHaveText(String(daysBefore - 1));

		// The refusals the seam owns: a date already blocked, a weekend, and no date at all —
		// each told which it was.
		await page.getByLabel('Blocked Day date').fill(inset);
		await page.getByRole('button', { name: 'Add day' }).click();
		await expect(
			page.getByRole('alert').filter({ hasText: 'is already a Blocked Day.' })
		).toBeVisible();

		const saturday = nextSaturday(plusDays(inset, 1));
		await page.getByLabel('Blocked Day date').fill(saturday);
		await page.getByRole('button', { name: 'Add day' }).click();
		await expect(
			page
				.getByRole('alert')
				.filter({ hasText: 'falls on a weekend. A Blocked Day must be a Monday to Friday.' })
		).toBeVisible();

		await page.getByLabel('Blocked Day date').fill('');
		await page.getByRole('button', { name: 'Add day' }).click();
		// A date input cannot type a malformed date, so the empty case is what reaches the
		// server here; the seam's own refusals are covered in the planner barrel suite.
		await expect(page.getByRole('alert').filter({ hasText: 'No date given.' })).toBeVisible();

		// A date outside every Term is accepted — a closure does not need a Term to be real.
		// Holds on any real-world day: the sixth Term closes at isoDate(168), so day 250 clears it
		// by well over the two days nextWeekday can add.
		const outside = nextWeekday(plusDays(new Date().toISOString().slice(0, 10), 250));
		await page.getByLabel('Blocked Day date').fill(outside);
		await page.getByRole('button', { name: 'Add day' }).click();
		await expect(page.getByLabel(`Remove Blocked Day ${outside}`)).toBeVisible();
		await expect(
			page.locator('section:has([data-blocked-days])').getByRole('status')
		).toBeVisible();

		// The school gives a day back: removed from the same list, Rewinding as the grid does.
		await page.getByLabel(`Remove Blocked Day ${outside}`).click();
		await expect(page.getByLabel(`Remove Blocked Day ${outside}`)).toHaveCount(0);
		await page.getByLabel(`Remove Blocked Day ${inset}`).click();
		await expect(page.getByLabel(`Remove Blocked Day ${inset}`)).toHaveCount(0);
		await expect(
			page.getByText('None set. Every teaching day in the Terms is open.')
		).toBeVisible();

		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect(page.getByRole('button', { name: 'Set up year' })).toBeVisible();
	});

	test('a Blocked Day and a School Holiday each collapse into one panel, told apart by shade', async () => {
		// A year built around the current week: Term 1 closes on its Monday and Term 2 opens on
		// its Wednesday, so the Tuesday of that week is outside every Term — a School Holiday —
		// and Monday with Wednesday to Friday are teaching days.
		// Holds on any real-world day, including a Saturday or Sunday "today": the (weekday + 6) %
		// 7 offset walks back to that ISO week's Monday from whichever day getUTCDay() reports (0
		// for Sunday through 6 for Saturday), not from an assumed weekday, so the built week is
		// always Monday-to-Friday even when the suite itself runs over the weekend.
		const todayIso = new Date().toISOString().slice(0, 10);
		const monday = plusDays(todayIso, -((weekdayOf(todayIso) + 6) % 7));
		const thursday = plusDays(monday, 3);
		const terms = [
			{ opens: plusDays(monday, -84), closes: monday },
			{ opens: plusDays(monday, 2), closes: plusDays(monday, 56) },
			{ opens: plusDays(monday, 70), closes: plusDays(monday, 84) },
			{ opens: plusDays(monday, 98), closes: plusDays(monday, 112) },
			{ opens: plusDays(monday, 126), closes: plusDays(monday, 140) },
			{ opens: plusDays(monday, 154), closes: plusDays(monday, 168) }
		];

		await page.goto('/calendar');
		await page.getByRole('button', { name: 'Set up year' }).click();
		for (const [i, term] of terms.entries()) {
			await page.getByLabel(`${TERM_NAMES[i]} opening date`).fill(term.opens);
			await page.getByLabel(`${TERM_NAMES[i]} closing date`).fill(term.closes);
		}
		await page.getByRole('button', { name: 'Save year' }).click();
		await expect(page.getByRole('button', { name: 'Set up year' })).toBeVisible();

		// The engineered week by name — not the default one, which over a weekend is the
		// following, wholly in-term week. Exactly one of its days, the Tuesday, is a School
		// Holiday: one panel spans its column, in place of six cells.
		await page.goto(`/calendar?week=${monday}`);
		await expect(page.locator('thead th[data-day-kind="holiday"]')).toHaveCount(1);
		await expect(page.locator('thead th[data-day-kind="holiday"]')).toContainText('Tue');
		await expect(page.locator('td[data-day-kind="holiday"]')).toHaveCount(1);
		await expect(page.locator('td[data-day-kind="holiday"]')).toContainText('School holiday');
		await expect(page.locator('td[data-day-kind="holiday"]')).toContainText('Outside every Term');
		await expect(page.locator('thead th[data-day-kind="teaching"]')).toHaveCount(4);

		// A Blocked Day entered on the School Holiday: the holiday still wins the panel's
		// headline, and the day's menu still offers Unblock day rather than hiding it. Blocking
		// it changes nothing the panel shows, so the menu itself is what confirms the write
		// landed before it is undone.
		await blockDayFromHeader('Tue');
		await openDayMenu('Tue');
		await expect(page.getByRole('menuitem', { name: 'Unblock day' })).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('td[data-day-kind="holiday"]')).toHaveCount(1);
		await expect(page.locator('td[data-day-kind="holiday"]')).toContainText('School holiday');
		await unblockDayFromHeader('Tue');
		await openDayMenu('Tue');
		await expect(page.getByRole('menuitem', { name: 'Block day' })).toBeVisible();
		await page.keyboard.press('Escape');

		// A Blocked Day with a note, added from setup mode: the panel's headline is the note
		// itself, not the plain fallback.
		await page.getByRole('button', { name: 'Set up year' }).click();
		await page.getByLabel('Blocked Day date').fill(thursday);
		await page.getByLabel('Blocked Day note').fill('Staff training day');
		await page.getByRole('button', { name: 'Add day' }).click();
		await expect(page.getByLabel(`Remove Blocked Day ${thursday}`)).toBeVisible();
		await page.getByRole('button', { name: 'Cancel' }).click();

		await expect(page.locator('thead th[data-day-kind="blocked"]')).toHaveCount(1);
		await expect(page.locator('thead th[data-day-kind="blocked"]')).toContainText('Thu');
		await expect(page.locator('td[data-day-kind="blocked"]')).toContainText('Staff training day');
		await expect(page.locator('td[data-day-kind="blocked"]')).toContainText('No teaching');

		// A Blocked Day with no note is the other row of the table: the plain fallback headline,
		// entered with a single menu click and no note asked for. Wednesday is in Term 2
		// whatever the real date.
		await blockDayFromHeader('Wed');
		await expect(page.locator('thead th[data-day-kind="blocked"]')).toHaveCount(2);
		await expect(page.locator('td[data-day-kind="blocked"]')).toHaveCount(2);
		await expect(
			page.locator('td[data-day-kind="blocked"]').filter({ hasText: 'Blocked day' })
		).toHaveCount(1);
		await expect(page.locator('thead th[data-day-kind="teaching"]')).toHaveCount(2);

		// Leave no Blocked Day behind: the planning API suite after this one reads an empty list.
		await unblockDayFromHeader('Wed');
		await page.getByRole('button', { name: 'Set up year' }).click();
		await page.getByLabel(`Remove Blocked Day ${thursday}`).click();
		await expect(page.getByLabel(`Remove Blocked Day ${thursday}`)).toHaveCount(0);
		await page.getByRole('button', { name: 'Cancel' }).click();
	});

	test('cancel returns to the week the teacher was on with nothing saved', async () => {
		// Land on a chosen week first, so "the week the teacher was on" is a fact to check.
		const selected = page.locator('[aria-current="true"]').first();
		const href = (await selected.getAttribute('href')) ?? '';
		await page.locator(`a[href="${href}"]`).click();
		await expect(page).toHaveURL(href);

		await page.getByRole('button', { name: 'Set up year' }).click();
		await page.getByLabel('Autumn 1 opening date').fill('2027-09-01');
		await page.getByRole('button', { name: 'Cancel' }).click();

		// The same week, still selected — and the draft walked away from is gone.
		await expect(page).toHaveURL(href);
		await expect(page.locator('[aria-current="true"]').first()).toHaveAttribute('href', href);

		await page.getByRole('button', { name: 'Set up year' }).click();
		const reopened = await page.getByLabel('Autumn 1 opening date').inputValue();
		expect(reopened).not.toBe('2027-09-01');
		await page.getByRole('button', { name: 'Cancel' }).click();
	});

	// The two arrows step the year the way the ribbon does. Each is handed a week commencing date,
	// not a link, so this asserts where the arrow lands and not merely that it is there.
	test('the previous and next arrows step to the neighbouring Teaching Week', async () => {
		await page.goto('/calendar');

		const here = await page.locator('[aria-current="true"]').first().getAttribute('href');
		const before = await page
			.locator(`a[href="${here}"]`)
			.locator('xpath=preceding-sibling::a[1]')
			.getAttribute('href');

		await page.getByLabel('Previous Teaching Week').click();
		await expect(page).toHaveURL(before ?? '');

		await page.getByLabel('Next Teaching Week').click();
		await expect(page).toHaveURL(here ?? '');
	});

	test('a planner with no Term set opens setup mode by itself', async () => {
		runFixture('clear-terms');

		await page.goto('/calendar');

		// The first-run empty state of the year: no grid to show, so the setup is already open.
		await expect(page.getByRole('button', { name: 'Save year' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Set up year' })).toBeHidden();
		await expect(page.locator('[data-term-rows] input[type="date"]')).toHaveCount(12);
	});
});
