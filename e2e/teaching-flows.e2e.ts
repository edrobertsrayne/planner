import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Runs after sign-in-out.e2e.ts (issue #97), logging in as the one user the wizard test created,
// rather than creating its own. File sorts after sign-in-out.e2e.ts and before
// user-settings-password.e2e.ts for the suite's single-worker ordering (see isolation.e2e.ts).
const EMAIL = 'teacher@example.com';
const PASSWORD = 'a-very-long-password';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function isoDate(offsetDays: number): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() + offsetDays);
	return d.toISOString().slice(0, 10);
}

// Mon-Fri (1-5) matching today's real weekday when it is one, otherwise Monday — the Calendar's
// default week rolls forward to the next full Teaching Week over a weekend, so every weekday of
// that week is still ahead of "today".
function nextTeachingDay(): number {
	const day = new Date().getUTCDay();
	return day >= 1 && day <= 5 ? day : 1;
}

function runFixture(...args: string[]): string {
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

async function openSessionAndExpect(page: Page) {
	await expect(page.getByRole('button', { name: 'Close Session' })).toBeVisible();
	await expect(page.getByLabel('How it went')).toBeVisible();
}

async function expectSessionClosed(page: Page) {
	await expect(page.getByRole('button', { name: 'Close Session' })).toBeHidden();
}

test.describe.serial('the rebuilt reading views and their Session panel', () => {
	let page: Page;
	let classAId = '';
	let classBId = '';
	let teachingDay: number;
	let dayName: string;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await login(page, EMAIL, PASSWORD);

		// A calendar spanning well before and after whatever real date this suite happens to run
		// on, generated fresh each run rather than pinned to the checked-in seed file — so the
		// suite never depends on which real date it runs on. The schema requires exactly six
		// Terms; only the second one, straddling today, is load-bearing.
		const terms = [
			{ name: 'Term 1', opens: isoDate(-84), closes: isoDate(-21) },
			{ name: 'Term 2', opens: isoDate(-14), closes: isoDate(56) },
			{ name: 'Term 3', opens: isoDate(70), closes: isoDate(84) },
			{ name: 'Term 4', opens: isoDate(98), closes: isoDate(112) },
			{ name: 'Term 5', opens: isoDate(126), closes: isoDate(140) },
			{ name: 'Term 6', opens: isoDate(154), closes: isoDate(168) }
		];
		const seedDir = mkdtempSync(path.join(tmpdir(), 'planner-e2e-'));
		const seedPath = path.join(seedDir, 'seed.json');
		writeFileSync(seedPath, JSON.stringify({ academicYear: 'e2e', terms, blockedDays: [] }));
		execFileSync('node', ['scripts/seed.ts', seedPath], {
			cwd: process.cwd(),
			env: { ...process.env, DATABASE_URL: 'e2e.db' }
		});

		// Course content: two Lessons, so the historical fixture below can consume the first and
		// leave the second queued as Next Up.
		await page.goto('/courses');
		await page.getByPlaceholder('New Course name — press Enter').fill('KS3 Science');
		await page.getByPlaceholder('New Course name — press Enter').press('Enter');
		await page.getByPlaceholder('New Topic name — press Enter').fill('Forces');
		await page.getByPlaceholder('New Topic name — press Enter').press('Enter');
		await page.getByPlaceholder('New Lesson title — press Enter').fill('Speed');
		await page.getByPlaceholder('New Lesson title — press Enter').press('Enter');
		await expect(page.getByRole('link', { name: 'Speed', exact: true })).toBeVisible();
		await page.getByPlaceholder('New Lesson title — press Enter').fill('Motion');
		await page.getByPlaceholder('New Lesson title — press Enter').press('Enter');
		await expect(page.getByRole('link', { name: 'Motion', exact: true })).toBeVisible();

		const speedLessonId = runFixture('find-lesson-id', 'Speed');

		// Two Classes from the Classes dialog.
		await page.goto('/classes');
		await page.getByRole('button', { name: 'New Class' }).first().click();
		await page.getByLabel('Label').fill('9B/Sc1');
		await page.getByRole('button', { name: 'Create Class' }).click();
		await page.waitForURL(/\/classes\/[^/]+$/);
		classAId = new URL(page.url()).pathname.split('/').pop()!;

		await page.goto('/classes');
		await page.getByRole('button', { name: 'New Class' }).first().click();
		await page.getByLabel('Label').fill('9C/Sc1');
		await page.getByRole('button', { name: 'Create Class' }).click();
		await page.waitForURL(/\/classes\/[^/]+$/);
		classBId = new URL(page.url()).pathname.split('/').pop()!;

		// The Teaching Week letter the Calendar opens on by default (the one covering today), so
		// the Slots given to both Classes land on a Calendar cell visible without navigating the
		// ribbon.
		await page.goto('/calendar');
		const letter = (await page.locator('[aria-current="true"]').first().innerText()).charAt(0);
		teachingDay = nextTeachingDay();
		dayName = DAYS[teachingDay - 1];

		await page.goto(`/classes/${classAId}`);
		await page
			.getByRole('button', {
				name: new RegExp(`^Week ${letter} ${dayName} P1 — empty`)
			})
			.click();
		await page.getByRole('button', { name: 'Assign next Topic' }).click();
		await page.getByRole('option', { name: 'Forces' }).click();

		await page.goto(`/classes/${classBId}`);
		await page
			.getByRole('button', {
				name: new RegExp(`^Week ${letter} ${dayName} P3 — empty`)
			})
			.click();

		// A Session dated before today — the only way "Last taught" is ever populated (there is
		// no way to create one through the UI, since the Class page refuses to edit the
		// Timetable in the past). Written last so no later rederive (triggered by the toggles and
		// the Topic assignment above) sweeps it away as an orphan.
		runFixture('mark-taught', classAId, isoDate(-10), '6', speedLessonId);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('a Class created from the Classes dialog lands on a distinct tone from the previous one', async () => {
		await page.goto('/classes');
		const toneOf = async (label: string) => {
			const dot = page
				.locator('li')
				.filter({ hasText: label })
				.locator('[aria-hidden="true"]')
				.first();
			return dot.evaluate((el) => getComputedStyle(el).backgroundColor);
		};
		const toneA = await toneOf('9B/Sc1');
		const toneB = await toneOf('9C/Sc1');
		expect(toneA).not.toBe(toneB);
	});

	test('the Lesson editor traps focus and closes on Escape', async () => {
		await page.goto('/courses');
		await page.getByRole('link', { name: 'KS3 Science' }).click();
		await page.getByRole('link', { name: 'Forces' }).click();
		await page.getByRole('link', { name: 'Speed', exact: true }).click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();

		// Tabbing all the way round a Dialog with a focus trap never leaves it.
		const tabStops = 12;
		for (let i = 0; i < tabStops; i++) {
			await page.keyboard.press('Tab');
			await expect(dialog.locator(':focus')).toHaveCount(1);
		}

		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
	});

	test('opening a Session from the Agenda, and dismissing it by the close button', async () => {
		await page.goto('/');
		const row = page.locator('li').filter({ hasText: '9B/Sc1' }).first();
		await row.getByRole('button').first().click();

		await openSessionAndExpect(page);
		await expect(page.locator('[data-session-panel]')).toContainText('9B/Sc1');

		await page.getByRole('button', { name: 'Close Session' }).click();
		await expectSessionClosed(page);
	});

	test('opening a Session from the Calendar, and dismissing it by Escape', async () => {
		await page.goto('/calendar');
		await page.getByRole('button', { name: '9C/Sc1 Unplanned' }).click();

		await openSessionAndExpect(page);
		await expect(page.locator('[data-session-panel]')).toContainText('9C/Sc1');

		await page.keyboard.press('Escape');
		await expectSessionClosed(page);
	});

	test('opening a Session from the Class page, and dismissing it by clicking away', async () => {
		await page.goto(`/classes/${classAId}`);
		await page.getByRole('button', { name: 'Speed' }).click();

		await openSessionAndExpect(page);
		await expect(page.locator('[data-session-panel]')).toContainText('Speed');

		await page.getByRole('heading', { name: '9B/Sc1' }).click();
		await expectSessionClosed(page);
	});

	test('clicking a second Agenda row switches the Session rather than closing and reopening it', async () => {
		await page.goto('/');
		await page
			.locator('li')
			.filter({ hasText: '9B/Sc1' })
			.first()
			.getByRole('button')
			.first()
			.click();
		await expect(page.locator('[data-session-panel]')).toContainText('9B/Sc1');

		await page
			.locator('li')
			.filter({ hasText: '9C/Sc1' })
			.first()
			.getByRole('button')
			.first()
			.click();
		await expect(page.locator('[data-session-panel]')).toContainText('9C/Sc1');
		// Never dropped out of view between the two clicks.
		await expect(page.getByRole('button', { name: 'Close Session' })).toBeVisible();
	});

	test('a note typed and then dismissed is present on reopen', async () => {
		await page.goto('/');
		const note = `Went well — ${Date.now()}`;

		await page
			.locator('li')
			.filter({ hasText: '9C/Sc1' })
			.first()
			.getByRole('button')
			.first()
			.click();
		await openSessionAndExpect(page);
		await page.getByLabel('How it went').fill(note);

		await page.keyboard.press('Escape');
		await expectSessionClosed(page);

		await page
			.locator('li')
			.filter({ hasText: '9C/Sc1' })
			.first()
			.getByRole('button')
			.first()
			.click();
		await expect(page.getByLabel('How it went')).toHaveValue(note);
	});

	test("the Agenda's horizon survives a reload via the URL", async () => {
		await page.goto('/');
		await page.getByRole('radio', { name: 'Next two weeks' }).click();
		await expect(page).toHaveURL(/horizon=14/);

		await page.reload();
		await expect(page).toHaveURL(/horizon=14/);
		await expect(page.getByRole('radio', { name: 'Next two weeks' })).toBeChecked();
	});

	test('the theme toggle persists across a reload', async () => {
		await page.goto('/');
		const isDark = () => page.evaluate(() => document.documentElement.classList.contains('dark'));

		const before = await isDark();
		await page.getByRole('button', { name: 'Toggle theme' }).click();
		await expect.poll(isDark).toBe(!before);

		await page.reload();
		await expect.poll(isDark).toBe(!before);
	});
});
