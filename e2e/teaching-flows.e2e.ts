import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

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

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await login(page, EMAIL, PASSWORD);

		// A calendar spanning well before and after whatever real date this suite happens to run
		// on, written straight into the scratch database each run — so the suite never depends on
		// which real date it runs on. Six Terms; only the second one, straddling today, is
		// load-bearing. The Week letters are derived from these dates, so this is the whole
		// calendar the app needs.
		const terms = [
			{ opens: isoDate(-84), closes: isoDate(-21) },
			{ opens: isoDate(-14), closes: isoDate(56) },
			{ opens: isoDate(70), closes: isoDate(84) },
			{ opens: isoDate(98), closes: isoDate(112) },
			{ opens: isoDate(126), closes: isoDate(140) },
			{ opens: isoDate(154), closes: isoDate(168) }
		];
		runFixture('set-terms', JSON.stringify(terms));

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

		await page.goto(`/classes/${classAId}`);
		// Three periods a week — Mon, Wed and Fri P1 — a realistic KS3 cadence, and enough future
		// Available Slots for the Planning test to page against: one fortnightly Slot supplies only
		// 8 before the fixture's Terms run out on a Saturday, leaving two of the ten Lessons
		// unscheduled inside the first page. The cells are positions, not dates — the grid is dated
		// today, so Monday's is clickable on a Wednesday too.
		for (const day of [1, 3, 5]) {
			await page
				.getByRole('button', {
					name: new RegExp(`^Week ${letter} ${DAYS[day - 1]} P1 — empty`)
				})
				.click();
		}
		await page.getByRole('button', { name: 'Assign next Topic' }).click();
		await page.getByRole('option', { name: 'Forces' }).click();

		await page.goto(`/classes/${classBId}`);
		// Tuesday P3 — a day classA leaves untouched — in BOTH letters, so whatever the run
		// date, a Tuesday sits within the Agenda's This Week horizon, and the week the Calendar
		// test loads always carries one. The cells are positions, not dates (see above).
		for (const week of ['A', 'B'] as const) {
			await page
				.getByRole('button', {
					name: new RegExp(`^Week ${week} Tue P3 — empty`)
				})
				.click();
		}

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
		// A Slot dated before today is on no stream — scheduled and openSlots both cut at today —
		// so the Calendar offers an Open Slot only from its date onward. 9C/Sc1's Slot is
		// Tuesday P3 in both letters, so load the week of the next Tuesday: this week's grid
		// early in the week, next week's from Wednesday on.
		const tuesday = (2 - new Date().getUTCDay() + 7) % 7;
		await page.goto(`/calendar?week=${isoDate(tuesday - 1)}`);
		await page.getByRole('button', { name: '9C/Sc1 Open Slot' }).click();
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
		await page.getByRole('radio', { name: 'Two Weeks' }).click();
		await expect(page).toHaveURL(/horizon=14/);

		await page.reload();
		await expect(page).toHaveURL(/horizon=14/);
		await expect(page.getByRole('radio', { name: 'Two Weeks' })).toBeChecked();
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

	test('the Planning tab filters, pages, and updates status with tones and counts', async () => {
		// Create additional lessons in Courses to reach 11 total so stream trimming is testable.
		await page.goto('/courses');
		await page.getByRole('link', { name: 'KS3 Science' }).click();
		await page.getByRole('link', { name: 'Forces' }).click();
		// Typed one after another with no click in between: the box keeps the caret after each
		// Enter, which is what lets a run of Lessons go in without touching the mouse.
		const nextLesson = page.getByPlaceholder('New Lesson title — press Enter');
		await nextLesson.click();
		// A caret is not visible to the suite, but the focus loss that kills it is: the box must not
		// blur once between the nine Enters.
		await nextLesson.evaluate((box: HTMLInputElement) => {
			box.dataset.blurs = '0';
			box.addEventListener('focusout', () => {
				box.dataset.blurs = String(Number(box.dataset.blurs) + 1);
			});
		});
		for (let i = 1; i <= 9; i++) {
			await expect(nextLesson).toBeFocused();
			await expect(nextLesson).toHaveValue('');
			await page.keyboard.type(`Extra Lesson ${i}`);
			await page.keyboard.press('Enter');
			await expect(
				page.getByRole('link', { name: `Extra Lesson ${i}`, exact: true })
			).toBeVisible();
		}
		await expect(nextLesson).toHaveAttribute('data-blurs', '0');

		await page.goto('/planning');

		const speedRow = page.locator('li').filter({ hasText: 'Speed' });
		const motionRow = page.locator('li').filter({ hasText: 'Motion' });

		// Motion is scheduled next, so it sits in the top 10; Speed was taught in the past so it
		// sits in the unscheduled tail past the initial 10-item limit.
		await expect(motionRow).toBeVisible();
		await expect(speedRow).toBeHidden();

		// Initial counts: 11 lessons, all Draft.
		const allFilter = page.getByRole('button', { name: /^All\s+\d+$/ });
		const draftFilter = page.getByRole('button', { name: /^Draft\s+\d+$/ });
		const plannedFilter = page.getByRole('button', { name: /^Planned\s+\d+$/ });
		await expect(allFilter).toContainText('11');
		await expect(draftFilter).toContainText('11');
		await expect(plannedFilter).toContainText('0');

		// Trimming line is visible with default Show 10.
		await expect(page.getByText('Showing 10 of 11')).toBeVisible();

		// Paging controls: Show all reveals all 11 items (including Speed) and hides trimming line.
		const showAllBtn = page.getByRole('button', { name: 'Show all' });
		const show10Btn = page.getByRole('button', { name: 'Show 10' });
		await showAllBtn.click();
		await expect(showAllBtn).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByText('Showing 10 of 11')).toBeHidden();
		await expect(speedRow).toBeVisible();

		await show10Btn.click();
		await expect(show10Btn).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByText('Showing 10 of 11')).toBeVisible();
		await expect(speedRow).toBeHidden();

		// Filtering by Planned shows the dashed empty state.
		await plannedFilter.click();
		await expect(page.getByText('No Planned Lessons')).toBeVisible();
		await expect(motionRow).toBeHidden();
		await expect(plannedFilter).toHaveAttribute('style', /var\(--success-bg\)/);

		// Filtering by Draft shows Draft tone on selected chip.
		await draftFilter.click();
		await expect(draftFilter).toHaveAttribute('style', /var\(--error-bg\)/);
		await expect(motionRow).toBeVisible();

		// Switch back to All to update status.
		await allFilter.click();

		// Advance 'Motion' to Planned from its row's segmented control.
		const motionPlannedBtn = motionRow.getByRole('button', { name: 'Planned' });
		await motionPlannedBtn.click();
		await expect(motionPlannedBtn).toHaveAttribute('aria-pressed', 'true');
		await expect(motionPlannedBtn).toHaveAttribute('style', /var\(--success-bg\)/);

		// Live counts update across the whole stream.
		await expect(allFilter).toContainText('11');
		await expect(draftFilter).toContainText('10');
		await expect(plannedFilter).toContainText('1');

		// Filter to Planned — only 'Motion' shows.
		await plannedFilter.click();
		await expect(motionRow).toBeVisible();
		await expect(page.getByText('Showing 10 of 11')).toBeHidden();

		// Filter to Draft — 'Motion' is hidden.
		await draftFilter.click();
		await expect(motionRow).toBeHidden();
		await expect(page.getByText('Showing 10 of 10')).toBeHidden();
	});

	test('ticking Ready on an Agenda row updates state and survives a reload', async () => {
		await page.goto('/');
		// Check that the heading carries "Ready to teach?"
		await expect(page.getByText('Ready to teach?').first()).toBeVisible();

		// Find the row for 9B/Sc1 (Motion)
		const row = page.locator('li').filter({ hasText: '9B/Sc1' }).first();
		const checkbox = row.getByRole('checkbox', { name: /Ready to teach/ });
		await expect(checkbox).toBeVisible();
		await expect(checkbox).not.toBeChecked();

		// Tick Ready
		await checkbox.click();
		await expect(checkbox).toBeChecked();

		// Reload and verify persistence
		await page.reload();
		const reloadedRow = page.locator('li').filter({ hasText: '9B/Sc1' }).first();
		const reloadedCheckbox = reloadedRow.getByRole('checkbox', { name: /Ready to teach/ });
		await expect(reloadedCheckbox).toBeChecked();

		// Open the Session and verify that the Session panel shows Ready read-only
		await reloadedRow.getByRole('button').first().click();
		await openSessionAndExpect(page);
		await expect(page.locator('[data-session-panel]')).toContainText('Ready');
		await page.getByRole('button', { name: 'Close Session' }).click();
		await expectSessionClosed(page);

		// Untick Ready and verify
		await reloadedCheckbox.click();
		await expect(reloadedCheckbox).not.toBeChecked();

		await page.reload();
		const finalRow = page.locator('li').filter({ hasText: '9B/Sc1' }).first();
		const finalCheckbox = finalRow.getByRole('checkbox', { name: /Ready to teach/ });
		await expect(finalCheckbox).not.toBeChecked();
	});
});
