import { test, expect, devices } from '@playwright/test';
import {
	TODAY,
	expectHitArea44,
	expectNoHorizontalScroll,
	login,
	mondayOf,
	plusDays,
	resetTo
} from './helpers.ts';

test.beforeAll(() => resetTo('standard'));

// The Calendar grid at each size. Touch mode: Playwright's Chromium matches `(pointer: coarse)` as
// soon as `hasTouch` is true; `isMobile` is not needed. Each describe sets its size and pointer
// with `test.use`.
test.describe('the Calendar on a tablet', () => {
	test.use({ viewport: { width: 800, height: 1180 }, hasTouch: true });

	// The block note is asked for in a dialog, not a popover over the tile, so it works by
	// touch as by mouse (issue #345). The week and the Slot come from teaching-flows, the way
	// the-calendar-setup.e2e.ts finds them; the Blocked Slot is undone before the test ends.
	test('the teacher blocks a Slot and saves its note by touch (story 106)', async ({ page }) => {
		// The classes' Slots were written for the Week letter the Calendar opened on when
		// teaching-flows ran; one of the two weeks after the engineered one carries that letter,
		// and its Monday P1 is 9B/Sc1's Slot.
		const mondayIso = mondayOf(TODAY);
		const mondayCell = page.locator('tbody tr').first().locator('td').first();
		await login(page);
		for (const offset of [7, 14]) {
			await page.goto(`/calendar?week=${plusDays(mondayIso, offset)}`);
			if ((await mondayCell.locator('a[href^="/sessions/"]').count()) > 0) break;
		}
		await expect(mondayCell.locator('a[href^="/sessions/"]')).toBeVisible();

		// Open the day's menu with a touch, and pick the Slot to block.
		const menu = page
			.locator('thead th')
			.filter({ hasText: 'Mon' })
			.getByRole('button', {
				name: /actions$/
			});
		await menu.tap();
		await page.getByRole('menuitem', { name: '9B/Sc1, P1…' }).tap();

		// The note is asked for in a dialog, reached and dismissed by touch alone.
		const note = page.getByRole('textbox', { name: 'Block 9B/Sc1, P1' });
		await expect(note).toBeVisible();
		await note.fill('Assembly');
		await page.getByRole('button', { name: 'Block', exact: true }).tap();

		// The tile drains: the hatch and the note in place of the Lesson it removed.
		await expect(mondayCell.locator('a[href^="/sessions/"]')).toHaveCount(0);
		await expect(mondayCell).toContainText('Assembly');

		// The same touch menu unblocks, leaving nothing behind for later tests.
		await menu.tap();
		await page.getByRole('menuitem', { name: 'Unblock 9B/Sc1, P1' }).tap();
		await expect(mondayCell.locator('a[href^="/sessions/"]')).toHaveCount(1);
		await expect(mondayCell).not.toContainText('Assembly');
	});
});

test.describe('the Calendar grid on a phone', () => {
	// `defaultBrowserType` would force a new worker inside a describe, so take the other fields.
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	// A bare load opens on the Teaching Week that holds TODAY (calendar/+page.server.ts,
	// defaultWeek). Its Monday heads the first day column.
	const monday = mondayOf(TODAY);

	test('the grid shows the five day heads and the six Periods (stories 98 and 101)', async ({
		page
	}) => {
		await login(page, '/calendar');
		// The corner cell of the head plus one cell per day, and one row per Period.
		await expect(page.locator('main thead th')).toHaveCount(6);
		await expect(page.locator('main tbody tr')).toHaveCount(6);
	});

	test('day heads read as a letter and a date (story 100)', async ({ page }) => {
		await login(page, '/calendar');
		const shown = await page
			.locator('main thead th:not(:first-child)')
			.evaluateAll((els) =>
				els.map((el) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim())
			);
		expect(shown).toEqual(
			['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(
				(name, i) => `${name[0]} ${Number(plusDays(monday, i).slice(8))}`
			)
		);
	});

	test('a tile gives way to its Class, and a tap opens the Session page (stories 99 and 101)', async ({
		page
	}) => {
		await login(page, '/calendar');
		const tiles = page.locator('main a[href^="/sessions/"]');
		await expect(tiles.first()).toBeVisible();
		const count = await tiles.count();
		expect(count).toBeGreaterThan(0);
		for (let i = 0; i < count; i++) {
			// Below `sm` a tile shows its Class, and an Open Slot adds the word "Open". The
			// Lesson title and the Topic are read on the Session page the tile opens.
			const lines = (await tiles.nth(i).innerText())
				.split('\n')
				.map((line) => line.trim())
				.filter(Boolean);
			expect(lines[0]).toMatch(/^\d[A-Z]\/Sc\d$/);
			expect(lines).toHaveLength(lines[1] === 'Open' ? 2 : 1);

			// The Class reads in full. A title on a tile may truncate (story 99); the Class
			// line is what makes the week's shape readable, so it may not (story 101).
			const label = tiles.nth(i).locator('span').first();
			expect(await label.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
		}

		// Any tile will do. 9C/Sc1 has one Slot a week, on Tuesday, so its tile is not a link once
		// that Tuesday is past.
		await tiles.first().click();
		await expect(page).toHaveURL(/\/sessions\//);
	});

	test('the week controls step weeks and Today returns to this week (story 102)', async ({
		page
	}) => {
		await login(page, '/calendar');

		// On a phone the week on show reads as its letter and its date between the arrows.
		// The label is the one paragraph in the controls row, so its text is matched whole.
		await expect(page.getByText(/^Week [AB] · w\/c \d{1,2} [A-Z][a-z]{2,3}$/)).toBeVisible();

		// The arrows step the week and the address names the week on show. Each href is read
		// before its click: after a click the arrow names the week beyond the one it opened.
		const next = page.getByRole('link', { name: 'Next Teaching Week' });
		const stepped = (await next.getAttribute('href'))!.split('week=')[1];
		await next.click();
		await expect(page).toHaveURL(`/calendar?week=${stepped}`);

		// Today returns to this week.
		const today = page.getByRole('link', { name: 'Today' });
		const current = (await today.getAttribute('href'))!.split('week=')[1];
		await today.click();
		await expect(page).toHaveURL(`/calendar?week=${current}`);
	});

	test('the week controls keep a 44 px target on touch (story 102)', async ({ page }) => {
		await login(page, '/calendar');
		// On the week a bare load opens on, Today stands down as a disabled button; the arrows
		// are links (they navigate by query string).
		await expectHitArea44(page, 'Previous Teaching Week', 'link');
		await expectHitArea44(page, 'Next Teaching Week', 'link');
		await expectHitArea44(page, 'Today', 'button');
	});
});

{
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	for (const [name, use, isPhone] of [
		['phone', { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch }, true],
		['tablet portrait', { viewport: { width: 800, height: 1180 }, hasTouch: true }, false],
		['tablet landscape', { viewport: { width: 1280, height: 800 }, hasTouch: true }, false]
	] as const) {
		test.describe(`the Calendar on a ${name}`, () => {
			test.use(use);

			// The day menu (block and unblock) and Set up year show from `md` up and not on a
			// phone (stories 104 and 105).
			test('fits the width, and the day menu and Set up year show by size', async ({ page }) => {
				await login(page, '/calendar');
				await expect(page.locator('main table')).toBeVisible();
				await expectNoHorizontalScroll(page);
				const dayMenu = page.getByRole('button', { name: /actions$/ });
				const setUpYear = page.getByRole('button', { name: 'Set up year' });
				if (isPhone) {
					// Hidden below `md`, and a hidden subtree is out of the accessibility tree, so a
					// role query finds nothing to open the calendar's writes (story 105).
					await expect(dayMenu).toHaveCount(0);
					await expect(setUpYear).toHaveCount(0);
				} else {
					await expect(dayMenu.first()).toBeVisible();
					await expect(setUpYear).toBeVisible();
					await expect(page.getByRole('link', { name: 'Previous Teaching Week' })).toBeVisible();
				}
			});
		});
	}
}
