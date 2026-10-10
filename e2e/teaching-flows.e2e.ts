import { test, expect, type Page } from '@playwright/test';
import { EMAIL, PASSWORD, isoDate, resetTo, runFixture } from './helpers.ts';

// Logs in as the one user that resetTo('standard') creates, and reads the standard state (see
// `reset` in scripts/e2e-fixtures.ts).
test.beforeAll(() => resetTo('standard'));

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

test.describe.serial('the rebuilt reading views and their Session page', () => {
	let page: Page;
	let classAId = '';
	let classBId = '';

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await login(page, EMAIL, PASSWORD);
		classAId = runFixture('find-class-id', '9B/Sc1');
		classBId = runFixture('find-class-id', '9C/Sc1');
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('the Lesson editor stays open on Escape, and Back returns to the Courses screen', async () => {
		await page.goto('/courses');
		await page.getByRole('link', { name: 'KS3 Science' }).click();
		await page.getByRole('link', { name: 'Forces' }).click();
		await page.getByRole('link', { name: 'Speed', exact: true }).click();

		await expect(page).toHaveURL(/\/lessons\//);
		await expect(page.getByRole('dialog')).toHaveCount(0);

		await page.keyboard.press('Escape');
		await expect(page).toHaveURL(/\/lessons\//);

		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL(/\/courses\/[^/?]+\?topic=/);
	});

	test('opening a Session from the Agenda, and going Back to the Agenda', async () => {
		await page.goto('/');
		const row = page.locator('li').filter({ hasText: '9B/Sc1' }).first();
		await row.getByRole('link').first().click();

		await openSessionAndExpect(page);
		await expect(page.locator('main')).toContainText('9B/Sc1');

		await page.getByRole('button', { name: 'Back' }).click();
		await expectSessionClosed(page);
	});

	test('opening a Session from the Calendar, and going Back to the Calendar', async () => {
		// An upcoming Open Slot, not a past one. 9C/Sc1's Slot is Tuesday P3 in both letters, so
		// load the week of the next Tuesday: this week's grid early in the week, next week's from
		// Wednesday on.
		const tuesday = (2 - new Date().getUTCDay() + 7) % 7;
		await page.goto(`/calendar?week=${isoDate(tuesday - 1)}`);
		await page.getByRole('link', { name: '9C/Sc1 Open Slot' }).click();
		await openSessionAndExpect(page);
		await expect(page.locator('main')).toContainText('9C/Sc1');

		await page.getByRole('button', { name: 'Back' }).click();
		await expectSessionClosed(page);
	});

	test('opening a Session from the Class page, and going Back to the Class page', async () => {
		await page.goto(`/classes/${classAId}`);

		// Overview leads with the next five Sessions (issue #348): 'Motion' on the next Slot,
		// then the Open Slots the plan runs out into.
		const nextSessions = page
			.locator('section')
			.filter({ has: page.getByRole('heading', { name: 'Next Sessions' }) });
		await expect(nextSessions.locator('li')).toHaveCount(5);
		await expect(nextSessions.locator('li').first()).toContainText('Motion');
		await expect(nextSessions.locator('li').nth(1)).toContainText('Open Slot');

		await nextSessions.locator('li').first().getByRole('link').click();

		await openSessionAndExpect(page);
		await expect(page.locator('main')).toContainText('Motion');

		await page.getByRole('button', { name: 'Back' }).click();
		await expectSessionClosed(page);
		await expect(page).toHaveURL(`/classes/${classAId}`);
	});

	test('a note typed and then dismissed is present on reopen', async () => {
		await page.goto('/');
		const note = `Went well — ${Date.now()}`;

		await page
			.locator('li')
			.filter({ hasText: '9C/Sc1' })
			.first()
			.getByRole('link')
			.first()
			.click();
		await openSessionAndExpect(page);
		const noteField = page.getByLabel('How it went');
		await noteField.click();
		await noteField.pressSequentially(note);

		await page.getByRole('button', { name: 'Back' }).click();
		await expectSessionClosed(page);

		await page
			.locator('li')
			.filter({ hasText: '9C/Sc1' })
			.first()
			.getByRole('link')
			.first()
			.click();
		await expect(page.getByLabel('How it went')).toHaveText(note);
	});

	test("the Agenda's horizon tabs change the horizon and survive a reload via the URL (issue #341)", async () => {
		await page.goto('/');
		await page.getByRole('tab', { name: 'Two Weeks' }).click();
		await expect(page).toHaveURL(/horizon=14/);

		await page.reload();
		await expect(page).toHaveURL(/horizon=14/);
		await expect(page.getByRole('tab', { name: 'Two Weeks' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
	});

	test("the Agenda's All horizon reaches past Four Weeks and survives a reload (issue #281)", async () => {
		const days = page.locator('main section');
		await page.goto('/?horizon=28');
		await expect(days.first()).toBeVisible();
		const fourWeeks = await days.count();

		await page.getByRole('tab', { name: 'All' }).click();
		await expect(page).toHaveURL(/horizon=all/);
		await expect.poll(() => days.count()).toBeGreaterThan(fourWeeks);

		await page.reload();
		await expect(page.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
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

	test('the Planning tab shows the whole stream and updates status with tones and counts', async () => {
		// Nine more Lessons in Courses: the stream then holds 11, and the counts below read 11.
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

		const speedRow = page.getByRole('row').filter({ hasText: 'Speed' });
		const motionRow = page.getByRole('row').filter({ hasText: 'Motion' });

		// The whole stream shows at once: Speed was taught in the past and so sits in the
		// unscheduled tail, and it is in view with no page size to trim it.
		await expect(motionRow).toBeVisible();
		await expect(speedRow).toBeVisible();
		await expect(page.getByRole('button', { name: /^(Show \d+|Show all)$/ })).toHaveCount(0);
		await expect(page.getByText(/^Showing \d+ of \d+$/)).toHaveCount(0);

		// Initial counts: 11 lessons, all Draft. The tabs at the right of the title carry the
		// counts and narrow the table.
		const allTab = page.getByRole('tab', { name: /^All\s+\d+$/ });
		const draftTab = page.getByRole('tab', { name: /^Draft\s+\d+$/ });
		const plannedTab = page.getByRole('tab', { name: /^Planned\s+\d+$/ });
		await expect(allTab).toContainText('11');
		await expect(draftTab).toContainText('11');
		await expect(plannedTab).toContainText('0');

		// The Planned tab narrows the table to Planned, and shows the dashed empty state with
		// nothing Planned.
		await plannedTab.click();
		await expect(page.getByText('No Planned Lessons')).toBeVisible();
		await expect(motionRow).toBeHidden();

		// The Draft tab narrows the table to Draft.
		await draftTab.click();
		await expect(motionRow).toBeVisible();

		// Switch back to All to update status.
		await allTab.click();

		// Advance 'Motion' to Planned from its row's segmented control.
		const motionPlannedBtn = motionRow.getByRole('button', { name: 'Planned' });
		await motionPlannedBtn.click();
		await expect(motionPlannedBtn).toHaveAttribute('aria-pressed', 'true');
		await expect(motionPlannedBtn).toHaveAttribute('style', /var\(--success-bg\)/);

		// Live counts update across the whole stream.
		await expect(allTab).toContainText('11');
		await expect(draftTab).toContainText('10');
		await expect(plannedTab).toContainText('1');

		// Filter to Planned — only 'Motion' shows.
		await plannedTab.click();
		await expect(motionRow).toBeVisible();

		// Filter to Draft — 'Motion' is hidden.
		await draftTab.click();
		await expect(motionRow).toBeHidden();
	});

	test('tagging a Lesson in the editor shows its chip on the Courses list and Planning', async () => {
		await page.goto('/courses');
		await page.getByRole('link', { name: 'KS3 Science' }).click();
		await page.getByRole('link', { name: 'Forces' }).click();
		await page.getByRole('link', { name: 'Motion', exact: true }).click();

		await page.getByRole('button', { name: '+ Add Tag' }).click();
		await page.getByPlaceholder('Tag name').fill('Practical');
		await page.getByPlaceholder('Tag name').press('Enter');
		await expect(page.locator('main').getByText('Practical', { exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL(/\/courses\/[^/?]+\?topic=/);

		const courseRow = page.locator('li').filter({ hasText: 'Motion' });
		await expect(courseRow.getByText('Practical', { exact: true })).toBeVisible();

		await page.goto('/planning');
		const motionRow = page.getByRole('row').filter({ hasText: 'Motion' });
		// The chip reads in the row at every size: in the Tags column, or folded under the title.
		await expect(motionRow).toContainText('Practical');
	});

	test('a Class chip narrows Planning to one Class, and a click on the chip again clears the filter', async () => {
		await page.goto('/planning');
		const allTab = page.getByRole('tab', { name: /^All\s+\d+$/ });
		const plannedTab = page.getByRole('tab', { name: /^Planned\s+\d+$/ });
		await expect(allTab).toContainText('11');

		// A Class chip narrows the stream to that Class and puts it in the URL.
		await page.getByRole('button', { name: '9B/Sc1' }).click();
		await page.waitForURL(`/planning?class=${classAId}`);

		// Only 9B/Sc1's upcoming Lessons, each dated by 9B/Sc1, with no unscheduled tail.
		const rows = page
			.getByRole('row')
			.filter({ has: page.getByRole('button', { name: 'Draft', exact: true }) });
		await expect(rows.first()).toContainText('9B/Sc1');
		await expect(rows.filter({ hasText: '9C/Sc1' })).toHaveCount(0);
		await expect(rows.filter({ hasText: '—' })).toHaveCount(0);
		await expect(allTab).not.toContainText('11');

		// The chip is on, and the filter is in the URL across a reload.
		await page.reload();
		await expect(page.getByRole('button', { name: '9B/Sc1' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(rows.filter({ hasText: '—' })).toHaveCount(0);

		// The status tabs narrow the Class's list further: Motion is the one Planned Lesson.
		await plannedTab.click();
		await expect(rows).toHaveCount(1);
		await expect(rows.first()).toContainText('Motion');

		// A click on the chip that is on returns to All Classes; the Planned tab stays, since the
		// two filters live in the address side by side.
		await page.getByRole('button', { name: '9B/Sc1' }).click();
		await page.waitForURL('/planning?status=planned');
		await expect(allTab).toContainText('11');

		// An unknown Class in the URL falls back to All Classes.
		await page.goto('/planning?class=no-such-class');
		await expect(allTab).toContainText('11');
		await expect(page.getByRole('button', { name: 'All Classes' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});

	test('Back from the Lesson editor keeps the Class filter', async () => {
		await page.goto('/planning');
		await page.getByRole('button', { name: '9B/Sc1' }).click();
		await page.waitForURL(`/planning?class=${classAId}`);
		await page.getByRole('link', { name: 'Motion', exact: true }).click();
		await expect(page).toHaveURL(/\/lessons\/[^/]+$/);
		await page.getByRole('button', { name: 'Back' }).click();
		await page.waitForURL(`/planning?class=${classAId}`);
		await expect(page.getByRole('button', { name: '9B/Sc1' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});

	test('the Draft/Planned tab lives in the query string', async () => {
		await page.goto('/planning');
		await page.getByRole('tab', { name: /^Draft/ }).click();
		await expect(page).toHaveURL(/status=draft/);
		await page.reload();
		await expect(page.getByRole('tab', { name: /^Draft/ })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		// Back from the Lesson editor remounts the page: the tab must survive it.
		await page.getByRole('link', { name: 'Speed', exact: true }).click();
		await expect(page).toHaveURL(/\/lessons\/[^/]+$/);
		await page.getByRole('button', { name: 'Back' }).click();
		await page.waitForURL(/status=draft/);
		await expect(page.getByRole('tab', { name: /^Draft/ })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await page.getByRole('tab', { name: /^All/ }).click();
		await expect(page).not.toHaveURL(/status=/);
	});

	test('a tagged Lesson shows its chip on the Agenda and Session page, and click-through from the Calendar', async () => {
		// Motion (9B/Sc1's next scheduled Lesson, carrying the Practical Tag attached above) is
		// this Class's row both on the Agenda and on the current week's Calendar grid.
		await page.goto('/');
		const agendaRow = page.locator('li').filter({ hasText: '9B/Sc1' }).first();
		await expect(agendaRow.getByText('Practical', { exact: true })).toBeVisible();

		await agendaRow.getByRole('link').first().click();
		await openSessionAndExpect(page);
		await expect(page.locator('main').getByText('Practical', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Back' }).click();
		await expectSessionClosed(page);

		// The Calendar tile itself carries no Tag — only the click-through does. Pinned to the same
		// week `defaultWeek` resolves today's date to (the week containing today, or the next one
		// during a weekend) — the week the standard state letters 9B/Sc1's Slots, so a bare
		// load would already agree, but pinning removes any doubt on a Saturday/Sunday run.
		const day = new Date().getUTCDay();
		const mondayOffset = day === 0 ? 1 : day === 6 ? 2 : 1 - day;
		await page.goto(`/calendar?week=${isoDate(mondayOffset)}`);
		const tile = page.getByRole('link').filter({ hasText: '9B/Sc1' }).filter({ hasText: 'Motion' });
		await expect(tile.getByText('Practical', { exact: true })).toBeHidden();
		await tile.click();
		await openSessionAndExpect(page);
		await expect(page.locator('main').getByText('Practical', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Back' }).click();
		await expectSessionClosed(page);
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

		// Open the Session and verify that the Session page shows Ready read-only
		await reloadedRow.getByRole('link').first().click();
		await openSessionAndExpect(page);
		await expect(page.locator('main')).toContainText('Ready');
		await page.getByRole('button', { name: 'Back' }).click();
		await expectSessionClosed(page);

		// Untick Ready and verify
		await reloadedCheckbox.click();
		await expect(reloadedCheckbox).not.toBeChecked();

		await page.reload();
		const finalRow = page.locator('li').filter({ hasText: '9B/Sc1' }).first();
		const finalCheckbox = finalRow.getByRole('checkbox', { name: /Ready to teach/ });
		await expect(finalCheckbox).not.toBeChecked();
	});

	test('the Agenda filters to one Tag, kept in the URL with the horizon (issue #280)', async () => {
		const rows = page.locator('main li');
		const openSlots = rows.filter({ hasText: 'Open Slot' });

		await page.goto('/?horizon=28');
		await expect(openSlots.first()).toBeVisible();

		// The Tag chips (issue #340) replace the dropdown: each Tag's chip carries the count of
		// rows it holds in the window, and the filter keeps exactly those rows.
		const held = await rows.filter({ has: page.getByText('Practical', { exact: true }) }).count();
		const practicalChip = page.getByRole('button', { name: new RegExp(`^Practical ${held}$`) });
		await practicalChip.click();
		await expect(page).toHaveURL(/horizon=28/);
		await expect(page).toHaveURL(/tag=Practical/);
		await expect(rows.filter({ hasText: '9B/Sc1' }).first()).toBeVisible();
		await expect(openSlots).toHaveCount(0);
		await expect(rows.filter({ hasNotText: 'Practical' })).toHaveCount(0);
		await expect(rows).toHaveCount(held);

		// The filter survives a Back from a Session.
		await rows.first().getByRole('link').first().click();
		await openSessionAndExpect(page);
		await page.getByRole('button', { name: 'Back' }).click();
		await expectSessionClosed(page);
		await expect(page).toHaveURL(/tag=Practical/);
		await expect(rows).toHaveCount(held);

		// A filtered row keeps its Ready tick. Each tick waits for its write and a reload, because
		// the write ends by reloading the page data, and that would cancel a navigation started first.
		const checkbox = rows.first().getByRole('checkbox', { name: /Ready to teach/ });
		const tick = () =>
			Promise.all([
				page.waitForResponse((r) => r.url().includes('setReadiness')),
				checkbox.click()
			]);
		await tick();
		await page.reload();
		await expect(practicalChip).toHaveAttribute('aria-pressed', 'true');
		await expect(checkbox).toBeChecked();
		await tick();
		await page.reload();
		await expect(checkbox).not.toBeChecked();

		await page.getByRole('tab', { name: 'Two Weeks' }).click();
		await expect(page).toHaveURL(/horizon=14/);
		await expect(page).toHaveURL(/tag=Practical/);

		// A second click on the chip that is on goes back to All Lessons (issue #340).
		await practicalChip.click();
		await expect(page).not.toHaveURL(/tag=/);
		await expect(page).toHaveURL(/horizon=14/);
		await expect(practicalChip).toHaveAttribute('aria-pressed', 'false');

		// The All Lessons chip clears the filter the same way.
		await practicalChip.click();
		await expect(page).toHaveURL(/tag=Practical/);
		await page.getByRole('button', { name: 'All Lessons' }).click();
		await expect(page).not.toHaveURL(/tag=/);

		// A Tag with no Lesson in the window keeps its chip at a count of zero, so it can be cleared.
		await page.goto('/?horizon=7&tag=Nowhere');
		const nowhereChip = page.getByRole('button', { name: 'Nowhere 0' });
		await expect(nowhereChip).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByText('No Lessons with the Tag “Nowhere”')).toBeVisible();
		await nowhereChip.click();
		await expect(page).not.toHaveURL(/tag=/);
	});

	test('a past Session on the Calendar keeps its tile on a hatch, never Blocked (issue #292)', async () => {
		// The Monday of the week seven days back: a weekday inside the second Term, before today.
		const ago = new Date(`${isoDate(-7)}T00:00:00Z`);
		const monday = isoDate(-7 - ((ago.getUTCDay() + 6) % 7));
		const speedLessonId = runFixture('find-lesson-id', 'Speed');
		runFixture('mark-taught', classAId, monday, '4', speedLessonId);

		await page.goto(`/calendar?week=${monday}`);
		// The standard state's Session ten days back can fall in this week too: either tile is past.
		const tile = page.locator('a[href^="/sessions/"]').filter({ hasText: 'Speed' }).first();
		await expect(tile).toBeVisible();
		await expect(tile).toContainText('9B/Sc1');
		await expect(tile).toContainText('Forces');
		await expect(tile).not.toContainText('Blocked');
		await expect(tile).toHaveClass(/hatched/);

		await tile.click();
		await openSessionAndExpect(page);
		await expect(page.locator('main')).toContainText('9B/Sc1');
		await expect(page.locator('main')).toContainText('Speed');
		await page.getByRole('button', { name: 'Back' }).click();
		await expectSessionClosed(page);

		runFixture('unmark-taught', classAId, monday, '4');
	});

	test('the look-back button above the first day shows and hides the past seven days (issue #341)', async () => {
		const lookBack = page.getByRole('region', { name: 'Past seven days' });
		const pastRows = lookBack.locator('li');
		const showPast = page.getByRole('button', { name: 'Show the previous 7 days' });
		const hidePast = page.getByRole('button', { name: 'Hide the previous 7 days' });

		// The only past Session so far is ten days old, outside the look-back.
		await page.goto('/?past=1');
		await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
		await expect(hidePast).toBeVisible();
		await expect(lookBack).toHaveCount(0);

		// Written last in the file: a past Session exists only through the fixture (see the standard state).
		const speedLessonId = runFixture('find-lesson-id', 'Speed');
		const note = `Ran out of time — ${Date.now()}`;
		runFixture('mark-taught', classBId, isoDate(-1), '5', speedLessonId);
		runFixture('mark-taught', classAId, isoDate(-3), '6', speedLessonId, note);

		// Speed is taught only in the past, so its Tag appears only in the look-back.
		await page.goto('/courses');
		await page.getByRole('link', { name: 'KS3 Science' }).click();
		await page.getByRole('link', { name: 'Forces' }).click();
		await page.getByRole('link', { name: 'Speed', exact: true }).click();
		await page.getByRole('button', { name: '+ Add Tag' }).click();
		await page.getByPlaceholder('Tag name').fill('Recap');
		await page.getByPlaceholder('Tag name').press('Enter');
		await expect(page.locator('main').getByText('Recap', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL(/\/courses\/[^/?]+\?topic=/);

		// The look-back is off by default.
		await page.goto('/');
		await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
		await expect(showPast).toBeVisible();
		await expect(hidePast).toHaveCount(0);
		await expect(lookBack).toHaveCount(0);

		await showPast.click();
		await expect(page).toHaveURL(/past=1/);
		// Oldest first: three days ago, then yesterday.
		await expect(pastRows).toHaveCount(2);
		await expect(pastRows.nth(0)).toContainText('9B/Sc1');
		await expect(pastRows.nth(1)).toContainText('9C/Sc1');
		await expect(lookBack.getByRole('heading')).toHaveCount(2);

		// The button sits above the first day, where the look-back appears.
		expect(
			await hidePast.evaluate((button) => {
				const firstDay = document.querySelector('main section');
				return Boolean(
					firstDay && button.compareDocumentPosition(firstDay) & Node.DOCUMENT_POSITION_FOLLOWING
				);
			})
		).toBe(true);

		// A past row carries no Ready tick; a future row still does.
		await expect(lookBack.getByRole('checkbox')).toHaveCount(0);
		await expect(
			page.getByRole('checkbox', { name: 'Ready to teach Motion to 9B/Sc1' }).first()
		).toBeVisible();

		// The horizon moves only the forward window, and keeps the look-back on.
		await page.getByRole('tab', { name: 'Four Weeks' }).click();
		await expect(page).toHaveURL(/horizon=28/);
		await expect(page).toHaveURL(/past=1/);
		await expect(pastRows).toHaveCount(2);

		// The look-back obeys the Tag filter: Speed does not carry Practical.
		await page.getByRole('button', { name: /^Practical \d+$/ }).click();
		await expect(page).toHaveURL(/tag=Practical/);
		await expect(page).toHaveURL(/past=1/);
		await expect(lookBack).toHaveCount(0);

		// A Tag found only in the look-back can be chosen, its chip counting the two past rows
		// it holds in the window (issue #340).
		await page.getByRole('button', { name: 'Recap 2' }).click();
		await expect(page).toHaveURL(/tag=Recap/);
		await expect(pastRows).toHaveCount(2);
		await expect(page.getByRole('checkbox', { name: /Ready to teach/ })).toHaveCount(0);

		// Turning the button off keeps the horizon and the Tag.
		await hidePast.click();
		await expect(page).not.toHaveURL(/past=/);
		await expect(page).toHaveURL(/horizon=28/);
		await expect(page).toHaveURL(/tag=Recap/);
		await expect(lookBack).toHaveCount(0);

		// An unknown value is off.
		await page.goto('/?past=yes');
		await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
		await expect(showPast).toBeVisible();
		await expect(hidePast).toHaveCount(0);
		await expect(lookBack).toHaveCount(0);

		// A past row opens the Session page on that occasion, with its note.
		await page.goto('/?past=1');
		await pastRows.nth(0).getByRole('link').first().click();
		await openSessionAndExpect(page);
		await expect(page.locator('main')).toContainText('9B/Sc1');
		await expect(page.getByLabel('How it went')).toHaveText(note);
		await page.getByRole('button', { name: 'Back' }).click();
		await expectSessionClosed(page);

		// A noted past Session left behind would show in the Term save report of the-calendar-setup.
		runFixture('unmark-taught', classBId, isoDate(-1), '5');
		runFixture('unmark-taught', classAId, isoDate(-3), '6');
		await page.goto('/courses');
		await page.getByRole('link', { name: 'KS3 Science' }).click();
		await page.getByRole('link', { name: 'Forces' }).click();
		await page.getByRole('link', { name: 'Speed', exact: true }).click();
		await page.getByRole('button', { name: 'Remove Recap' }).click();
		await expect(page.locator('main').getByText('Recap', { exact: true })).toBeHidden();
	});

	test('a Class created from the Classes dialog opens its page and takes a distinct tone', async () => {
		await page.goto('/classes');
		await page.getByRole('button', { name: 'New Class' }).first().click();
		await page.getByLabel('Label').fill('9D/Sc1');
		await page.getByRole('button', { name: 'Create Class' }).click();
		await page.waitForURL(/\/classes\/[^/]+$/);
		await expect(page.getByRole('heading', { level: 1, name: '9D/Sc1' })).toBeVisible();

		await page.goto('/classes');
		const toneOf = async (label: string) => {
			const dot = page
				.locator('li')
				.filter({ hasText: label })
				.locator('[aria-hidden="true"]')
				.first();
			return dot.evaluate((el) => getComputedStyle(el).backgroundColor);
		};
		expect(await toneOf('9D/Sc1')).not.toBe(await toneOf('9C/Sc1'));
	});
});
