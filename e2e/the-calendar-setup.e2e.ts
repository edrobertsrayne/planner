import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

// Covers the Calendar's setup mode (issue #166): opening it, the six fixed Term rows, the live
// preview, saving through the Terms seam, Cancel, and the empty planner opening it by itself.
// Runs after teaching-flows.e2e.ts, whose set-terms fixture gives the mode a saved year to edit,
// and before the-planning-api.e2e.ts, which needs no Terms — so ending with the year cleared
// disturbs nothing that runs later.
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

async function login(page: Page, email: string, password: string) {
	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page).toHaveURL('/');
}

test.describe.serial('the Calendar setup mode', () => {
	let page: Page;

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
		await expect(page.locator('input[type="date"]')).toHaveCount(12);

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

	test('cancel returns to the week the teacher was on with nothing saved', async () => {
		// Land on a chosen week first, so "the week the teacher was on" is a fact to check.
		const selected = page.locator('[aria-current="true"]').first();
		const href = await selected.getAttribute('href');
		await page.locator(`a[href="${href}"]`).click();
		await expect(page).toHaveURL(new RegExp(`\\${href}$`));

		await page.getByRole('button', { name: 'Set up year' }).click();
		await page.getByLabel('Autumn 1 opening date').fill('2027-09-01');
		await page.getByRole('button', { name: 'Cancel' }).click();

		// The same week, still selected — and the draft walked away from is gone.
		await expect(page).toHaveURL(new RegExp(`\\${href}$`));
		await expect(page.locator('[aria-current="true"]').first()).toHaveAttribute('href', href);

		await page.getByRole('button', { name: 'Set up year' }).click();
		const reopened = await page.getByLabel('Autumn 1 opening date').inputValue();
		expect(reopened).not.toBe('2027-09-01');
		await page.getByRole('button', { name: 'Cancel' }).click();
	});

	test('a planner with no Term set opens setup mode by itself', async () => {
		runFixture('clear-terms');

		await page.goto('/calendar');

		// The first-run empty state of the year: no grid to show, so the setup is already open.
		await expect(page.getByRole('button', { name: 'Save year' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Set up year' })).toBeHidden();
		await expect(page.locator('input[type="date"]')).toHaveCount(12);
	});
});
