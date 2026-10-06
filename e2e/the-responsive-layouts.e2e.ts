import { test, expect, devices, type Locator, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

// Runs after the-planning-api/ and before user-settings-password.e2e.ts, for the suite's
// single-worker ordering (see isolation.e2e.ts). Reads the one user and the KS3 Science course
// that earlier files built, and creates nothing that lasts: the block-note test undoes its own
// Blocked Slot, and the Class chip row test deletes the six Filler Classes it made.
//
// Touch mode: Playwright's Chromium matches `(pointer: coarse)` as soon as `hasTouch` is true;
// `isMobile` is not needed. Each describe sets its size and pointer with `test.use`.
//
// Playwright counts an element at opacity 0 as visible, so "shown" is asserted on its opacity.
const EMAIL = 'teacher@example.com';
const PASSWORD = 'a-very-long-password';

async function login(page: Page) {
	await page.goto('/login');
	await page.getByLabel('Email').fill(EMAIL);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page).toHaveURL('/');
}

async function openCourse(page: Page) {
	await login(page);
	await page.goto('/courses');
	await page.getByRole('link', { name: 'KS3 Science' }).click();
}

test.describe('the tablet layout (touch, about 800×1180)', () => {
	// Pixel Tablet, by hand.
	test.use({ viewport: { width: 800, height: 1180 }, hasTouch: true });

	test('a row control shows without a hover', async ({ page }) => {
		await openCourse(page);
		const pencil = page.getByRole('button', { name: /^Rename / }).first();
		await expect(pencil).toBeVisible();
		await expect(pencil).not.toHaveCSS('opacity', '0');
	});

	test('the look-back button keeps a 44 px hit area on touch (issue #341)', async ({ page }) => {
		await login(page);
		// The button is drawn at the shadcn size from `md` up; its hit area comes from the
		// shared touch rule (touch-target.ts).
		await expectHitArea44(page, 'Show the previous 7 days', 'button');
	});

	// The block note is asked for in a dialog, not a popover over the tile, so it works by
	// touch as by mouse (issue #345). The week and the Slot come from teaching-flows, the way
	// the-calendar-setup.e2e.ts finds them; the Blocked Slot is undone before the test ends.
	test('the teacher blocks a Slot and saves its note by touch (story 106)', async ({ page }) => {
		// The classes' Slots were written for the Week letter the Calendar opened on when
		// teaching-flows ran; one of the two weeks after the engineered one carries that letter,
		// and its Monday P1 is 9B/Sc1's Slot.
		const monday = new Date();
		monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
		const mondayIso = monday.toISOString().slice(0, 10);
		const plusDays = (iso: string, days: number) => {
			const d = new Date(`${iso}T00:00:00Z`);
			d.setUTCDate(d.getUTCDate() + days);
			return d.toISOString().slice(0, 10);
		};
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
		await expect(mondayCell.locator('.hatched')).toBeVisible();
		await expect(mondayCell).toContainText('Assembly');

		// The same touch menu unblocks, leaving nothing behind for later files.
		await menu.tap();
		await page.getByRole('menuitem', { name: 'Unblock 9B/Sc1, P1' }).tap();
		await expect(mondayCell.locator('a[href^="/sessions/"]')).toHaveCount(1);
		await expect(mondayCell).not.toContainText('Assembly');
	});
});

test.describe('the laptop layout (mouse)', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('a long Topic title wraps in full, and Delete Topic asks before it deletes', async ({
		page
	}) => {
		await openCourse(page);
		const title = 'A very long Topic title that has to wrap inside the narrow column of Topics';
		const box = page.getByPlaceholder('New Topic name — press Enter');
		await box.fill(title);
		await box.press('Enter');
		const link = page.getByRole('link', { name: title });
		await expect(link).toBeVisible();
		expect(await link.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

		await page.getByRole('button', { name: 'Topic actions' }).click();
		await page.getByRole('menuitem', { name: 'Delete Topic' }).click();
		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect(link).toBeVisible();

		await page.getByRole('button', { name: 'Topic actions' }).click();
		await page.getByRole('menuitem', { name: 'Delete Topic' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
		await expect(link).toHaveCount(0);
	});

	test('a long Lesson title wraps in full on the Agenda (issue #341)', async ({ page }) => {
		await openSessionWithLesson(page);
		await page.getByRole('link', { name: 'Open in Lesson editor' }).click();
		await expectLessonPage(page);
		const lessonUrl = page.url();
		const title = page.getByRole('textbox', { name: 'Lesson title' });
		const original = await title.inputValue();
		const longTitle =
			'A very long Lesson title that has to wrap in full inside the Agenda row instead of being cut off, and it keeps going well past one line at every window size the teacher uses';

		await title.fill(longTitle);
		await page
			.getByRole('navigation', { name: 'Primary' })
			.getByRole('link', { name: 'Agenda' })
			.click();
		await expect(page).toHaveURL('/');

		// The whole title reads on as many lines as it needs: nothing is cut off.
		const shown = page.getByText(longTitle, { exact: true }).first();
		await expect(shown).toBeVisible();
		expect(await shown.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

		// Put the title back for the files that follow.
		await page.goto(lessonUrl);
		await title.fill(original);
		await page
			.getByRole('navigation', { name: 'Primary' })
			.getByRole('link', { name: 'Agenda' })
			.click();
		await expect(page.getByText(original, { exact: true }).first()).toBeVisible();
	});

	test('Delete Course asks before it deletes, and a Course with Classes refuses', async ({
		page
	}) => {
		await openCourse(page);
		await page.getByRole('button', { name: 'Course actions' }).click();
		await page.getByRole('menuitem', { name: 'Delete Course' }).click();
		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect(page.getByRole('heading', { level: 1, name: 'KS3 Science' })).toBeVisible();

		await page.getByRole('button', { name: 'Course actions' }).click();
		await page.getByRole('menuitem', { name: 'Delete Course' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
		await expect(page.getByRole('alert')).toContainText('A Class follows this Course');
	});

	test('a row control is hidden until the row is hovered or holds focus', async ({ page }) => {
		await openCourse(page);
		const pencil = page.getByRole('button', { name: /^Rename / }).first();
		await expect(pencil).toHaveCSS('opacity', '0');

		await pencil.focus();
		await expect(pencil).toHaveCSS('opacity', '1');
	});

	test('a row control shows on hover', async ({ page }) => {
		await openCourse(page);
		const pencil = page.getByRole('button', { name: /^Rename / }).first();
		await expect(pencil).toHaveCSS('opacity', '0');

		await pencil.hover({ force: true });
		await expect(pencil).toHaveCSS('opacity', '1');
	});
});

function runFixture(...args: string[]): string {
	return execFileSync('bun', ['scripts/e2e-fixtures.ts', ...args], {
		cwd: process.cwd(),
		env: { ...process.env, DATABASE_URL: 'e2e.db' },
		encoding: 'utf-8'
	});
}

// The Lesson editor shows its title as a field on a laptop or tablet, and as a heading on a phone.
async function expectLessonPage(page: Page) {
	await expect(page).toHaveURL(/\/lessons\//);
	await expect(
		page.getByRole('textbox', { name: 'Lesson title' }).or(page.getByRole('heading', { level: 1 }))
	).toBeVisible();
}

// The Lesson editor of Speed by its address: the Courses screen is not usable at every size yet.
async function openLesson(page: Page) {
	await login(page);
	await page.goto(`/lessons/${runFixture('find-lesson-id', 'Speed').trim()}`);
	await expectLessonPage(page);
}

// The Lesson editor of Speed, opened from the Courses screen as Ed opens it.
async function openLessonFromCourses(page: Page) {
	await openCourse(page);
	await page.getByRole('link', { name: 'Forces' }).click();
	await page.getByRole('link', { name: 'Speed', exact: true }).click();
	await expectLessonPage(page);
}

async function expectNoHorizontalScroll(page: Page) {
	const fits = await page.evaluate(
		() => document.documentElement.scrollWidth <= document.documentElement.clientWidth
	);
	expect(fits).toBe(true);
}

// The Settings cards (issue #349): below `lg` Change password, API key and Backup stand in one
// column, API key under Change password and Backup under API key; from `lg` the password card
// stands beside the right column. The geometry is read from the page; every field of the shape
// is asserted, so a layout that reads two ways cannot slip through either check.
//
// The geometry of the three cards, read from the page. `null` names a card that is not there.
async function settingsGeometry(page: Page) {
	// The card title is a div, not a heading element; wait for the cards before measuring.
	await expect(
		page.locator('[data-slot="card-title"]').filter({ hasText: 'Change password' })
	).toBeVisible();
	return page.evaluate(() => {
		const cardWith = (text: string) =>
			[...document.querySelectorAll('[data-slot="card"]')].find((card) =>
				card.querySelector('[data-slot="card-title"]')?.textContent?.includes(text)
			) as HTMLElement | undefined;
		const password = cardWith('Change password');
		const apiKey = cardWith('API key');
		const backup = cardWith('Backup');
		if (!password || !apiKey || !backup) return null;
		const box = (el: HTMLElement) => el.getBoundingClientRect();
		const sameLeft = (a: HTMLElement, b: HTMLElement) => Math.abs(box(a).left - box(b).left) < 1;
		const stacked = (a: HTMLElement, b: HTMLElement) =>
			sameLeft(a, b) && box(b).top > box(a).top && box(a).bottom <= box(b).top + 1;
		return {
			// One column: API key under Change password, Backup under API key.
			passwordFirst: sameLeft(apiKey, password) && stacked(password, apiKey),
			backupUnderApiKey: stacked(apiKey, backup),
			// Two columns: password on the left, API key and Backup stacked on the right, and API
			// key level with the top of the password card.
			passwordLeft: box(apiKey).left > box(password).left,
			apiKeyBeside: Math.abs(box(apiKey).top - box(password).top) < 8,
			backupStacked: stacked(apiKey, backup)
		};
	});
}

async function expectOneColumn(page: Page) {
	expect(await settingsGeometry(page)).toEqual({
		passwordFirst: true,
		backupUnderApiKey: true,
		passwordLeft: false,
		apiKeyBeside: false,
		backupStacked: true
	});
}

async function expectTwoColumns(page: Page) {
	expect(await settingsGeometry(page)).toEqual({
		passwordFirst: false,
		backupUnderApiKey: true,
		passwordLeft: true,
		apiKeyBeside: true,
		backupStacked: true
	});
}

test.describe('the App shell on a laptop', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('the Lesson editor fits the width', async ({ page }) => {
		await openLesson(page);
		await expectNoHorizontalScroll(page);
	});

	test('the sidebar names the five screens and holds Settings, theme, Log out and the build line', async ({
		page
	}) => {
		await login(page);
		const nav = page.getByRole('navigation', { name: 'Primary' });
		for (const name of ['Agenda', 'Calendar', 'Classes', 'Courses', 'Planning']) {
			await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
			await expect(nav.getByRole('link', { name, exact: true })).toHaveText(name);
		}
		const sidebar = page.locator('aside').first();
		await expect(sidebar.getByRole('link', { name: 'Settings' })).toBeVisible();
		await expect(sidebar.getByRole('button', { name: 'Toggle theme' })).toBeVisible();
		await expect(sidebar.getByRole('button', { name: 'Log out' })).toBeVisible();
		await expect(sidebar.getByText(/^Build /)).toBeVisible();
		await expect(page.locator('body > div header')).toBeHidden();
	});

	test('no screen is lit while Settings is open', async ({ page }) => {
		await login(page);
		await page.goto('/settings');
		await expect(
			page.getByRole('navigation', { name: 'Primary' }).locator('[aria-current]')
		).toHaveCount(0);
	});

	test('the window is the only scroller', async ({ page }) => {
		await login(page);
		await page.goto('/calendar');
		const scrollers = await page.evaluate(
			() =>
				[...document.querySelectorAll('main > *')].filter(
					(el) =>
						getComputedStyle(el).overflowY === 'auto' || getComputedStyle(el).overflowY === 'scroll'
				).length
		);
		expect(scrollers).toBe(0);
	});

	test('the Agenda fits the width', async ({ page }) => {
		await login(page);
		await expectNoHorizontalScroll(page);
	});
});

test.describe('the App shell on a tablet in landscape', () => {
	test.use({ viewport: { width: 1280, height: 700 }, hasTouch: true });

	test('the Course page shows the Topics beside the Lessons and fits the width', async ({
		page
	}) => {
		await openCourse(page);
		// With no Topic chosen the first Topic's Lessons show, so the panel is there at once.
		await expect(page.getByRole('region', { name: 'Lessons' })).toBeVisible();
		await expectNoHorizontalScroll(page);
		await page.getByRole('link', { name: 'Forces' }).click();
		await expect(page).toHaveURL(/\/courses\/[^/?]+\?topic=/);
		await expect(page.getByRole('link', { name: 'Forces' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Speed', exact: true })).toBeVisible();
		await expectNoHorizontalScroll(page);
	});

	test('the Lesson editor fits the width', async ({ page }) => {
		await openLesson(page);
		await expectNoHorizontalScroll(page);
	});

	test('the Agenda fits the width', async ({ page }) => {
		await login(page);
		await expectNoHorizontalScroll(page);
	});
});

test.describe('the App shell on a tablet in portrait', () => {
	test.use({ viewport: { width: 800, height: 1180 }, hasTouch: true });

	test('the Lesson editor fits the width', async ({ page }) => {
		await openLesson(page);
		await expectNoHorizontalScroll(page);
	});

	test('the Course page shows the Topics, then the Lessons of one with a way back', async ({
		page
	}) => {
		await openCourse(page);
		await expect(page.getByRole('link', { name: 'Forces' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Speed', exact: true })).toBeHidden();
		await expectNoHorizontalScroll(page);

		await page.getByRole('link', { name: 'Forces' }).click();
		await expect(page.getByRole('link', { name: 'Speed', exact: true })).toBeVisible();
		await expectNoHorizontalScroll(page);
		await page.getByRole('link', { name: 'Topics', exact: true }).click();
		await expect(page.getByRole('link', { name: 'Speed', exact: true })).toBeHidden();
		await expect(page.getByRole('link', { name: 'Forces' })).toBeVisible();
	});

	test('the sidebar shows icons only, each with a tooltip', async ({ page }) => {
		await login(page);
		const agenda = page.getByRole('navigation', { name: 'Primary' }).getByRole('link', {
			name: 'Agenda'
		});
		await expect(agenda).toBeVisible();
		expect((await agenda.boundingBox())!.width).toBeLessThan(64);
		await agenda.hover();
		await expect(page.locator('[data-slot=tooltip-content]', { hasText: 'Agenda' })).toBeVisible();
	});

	test('the Agenda fits the width', async ({ page }) => {
		await login(page);
		await expectNoHorizontalScroll(page);
	});
});

test.describe('the App shell on a phone', () => {
	// `defaultBrowserType` would force a new worker inside a describe, so take the other fields.
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	test('the Lesson editor fits the width', async ({ page }) => {
		await openLesson(page);
		await expectNoHorizontalScroll(page);
	});

	test('the Lesson editor is a read view that steps and writes nothing', async ({ page }) => {
		await openLesson(page);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Speed');
		await expect(page.getByText('Forces', { exact: true }).first()).toBeVisible();
		await expect(page.getByText(/^(Draft|Planned)$/)).toBeVisible();

		// Nothing on the page takes a write.
		await expect(page.getByRole('textbox')).toHaveCount(0);
		await expect(
			page.getByRole('button', { name: /Delete Lesson|Detach|Add |Remove|^Draft$|^Planned$/ })
		).toHaveCount(0);

		await page.getByRole('button', { name: 'Next Lesson' }).click();
		await expect(page.getByText(/^Lesson 2 of \d+$/)).toBeVisible();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Motion');
		await page.getByRole('button', { name: 'Previous Lesson' }).click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Speed');
		await expectNoHorizontalScroll(page);
	});

	test('the Course page fits the width', async ({ page }) => {
		await openCourse(page);
		await expectNoHorizontalScroll(page);
		await page.getByRole('link', { name: 'Forces' }).click();
		await expect(page.getByRole('link', { name: 'Speed', exact: true })).toBeVisible();
		await expectNoHorizontalScroll(page);
	});

	test('the drawer opens from the menu button and goes to the Agenda', async ({ page }) => {
		await login(page);
		await page.goto('/calendar');
		await expect(page.getByRole('link', { name: 'Agenda' })).toBeHidden();

		await page.getByRole('button', { name: 'Menu' }).click();
		const drawer = page.getByRole('dialog');
		await expect(drawer.getByRole('link', { name: 'Courses' })).toBeVisible();
		await expect(drawer.getByRole('link', { name: 'Settings' })).toBeVisible();
		await expect(drawer.getByRole('button', { name: 'Log out' })).toBeVisible();
		await expect(drawer.getByText(/^Build /)).toBeVisible();

		await drawer.getByRole('link', { name: 'Agenda' }).click();
		await expect(page).toHaveURL('/');
		await expect(drawer).toBeHidden();
	});

	test('the Agenda fits the width', async ({ page }) => {
		await login(page);
		await expectNoHorizontalScroll(page);
	});
});

test.describe('the Agenda on a phone', () => {
	// `defaultBrowserType` would force a new worker inside a describe, so take the other fields.
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	test('the teacher reads the Agenda and ticks Ready on a row (phone flow 2)', async ({ page }) => {
		await login(page);
		await expectNoHorizontalScroll(page);

		// The top bar names the screen, so the page heading is hidden below `md` (story 81).
		await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);

		// Reading and ticking Ready is all the Agenda takes on a phone: nothing else writes.
		await expect(page.getByRole('textbox')).toHaveCount(0);

		// The teacher ticks Ready on a row (story 82). On touch the tick's padded label is its 44 px
		// target and covers the 16 px input, so the tap goes to the label. Each step waits for the
		// write and a reload, because the write ends by reloading the page data
		// (teaching-flows.e2e.ts).
		const tickOf = () =>
			page
				.locator('li')
				.filter({ hasText: '9B/Sc1' })
				.first()
				.getByRole('checkbox', { name: /Ready to teach/ });
		const tick = () =>
			Promise.all([
				page.waitForResponse((r) => r.url().includes('setReadiness')),
				tickOf().locator('xpath=..').click()
			]);
		await expect(tickOf()).not.toBeChecked();
		await tick();
		await page.reload();
		await expect(tickOf()).toBeChecked();

		// Put the tick back for the files that follow.
		await tick();
		await page.reload();
		await expect(tickOf()).not.toBeChecked();
	});

	test('Ready and Plan keep a 44 px target on touch, and Plan shows without a hover', async ({
		page
	}) => {
		await login(page);
		// 9C/Sc1 gets no Topic assigned, so its Tuesday P3 Slot carries no Lesson and its row
		// reads Open Slot in every week (teaching-placement.e2e.ts): a horizon that reaches the
		// next Tuesday always holds one.
		await page.goto('/?horizon=28');
		const plan = page
			.locator('li')
			.filter({ hasText: 'Open Slot' })
			.first()
			.getByRole('link', { name: 'Plan' });
		await expect(plan).toBeVisible();

		// On touch there is no hover to wait for (story 83): the control shows, muted.
		await expect(plan).not.toHaveCSS('opacity', '0');
		await expectHitArea44(page, 'Plan', 'link');
		await expectHitArea44(page, /Ready to teach/, 'checkbox');
	});
});

test.describe('the Calendar grid on a phone', () => {
	// `defaultBrowserType` would force a new worker inside a describe, so take the other fields.
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	// A bare load opens on the Teaching Week that holds today, or on the next one at a weekend
	// (calendar/+page.server.ts, defaultWeek). Its Monday heads the first day column.
	function defaultMonday(): Date {
		const day = new Date().getUTCDay();
		const offset = day === 0 ? 1 : day === 6 ? 2 : 1 - day;
		return new Date(Date.now() + offset * 86_400_000);
	}

	test('the grid shows the five day heads and the six Periods (stories 98 and 101)', async ({
		page
	}) => {
		await login(page);
		await page.goto('/calendar');
		// The corner cell of the head plus one cell per day, and one row per Period.
		await expect(page.locator('main thead th')).toHaveCount(6);
		await expect(page.locator('main tbody tr')).toHaveCount(6);
	});

	test('day heads read as a letter and a date (story 100)', async ({ page }) => {
		await login(page);
		await page.goto('/calendar');
		const shown = await page
			.locator('main thead th:not(:first-child)')
			.evaluateAll((els) =>
				els.map((el) => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim())
			);
		const monday = defaultMonday();
		expect(shown).toEqual(
			['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((name, i) => {
				const date = new Date(monday.getTime() + i * 86_400_000);
				return `${name[0]} ${date.getUTCDate()}`;
			})
		);
	});

	test('a tile gives way to its Class, and a tap opens the Session page (stories 99 and 101)', async ({
		page
	}) => {
		await login(page);
		await page.goto('/calendar');
		const tiles = page.locator('main a[href^="/sessions/"]');
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

		await tiles.filter({ hasText: '9C/Sc1' }).first().click();
		await expect(page).toHaveURL(/\/sessions\//);
	});

	test('the week controls step weeks and Today returns to this week (story 102)', async ({
		page
	}) => {
		await login(page);
		await page.goto('/calendar');

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
		await login(page);
		await page.goto('/calendar');
		// On the week a bare load opens on, Today stands down as a disabled button; the arrows
		// are links (they navigate by query string).
		await expectHitArea44(page, 'Previous Teaching Week', 'link');
		await expectHitArea44(page, 'Next Teaching Week', 'link');
		await expectHitArea44(page, 'Today', 'button');
	});

	test('no day menu and no Set up year show (story 105)', async ({ page }) => {
		await login(page);
		await page.goto('/calendar');
		// The day menu and Set up year are hidden below `md`, and a hidden subtree is out of
		// the accessibility tree, so a role query finds nothing to open the calendar's writes.
		await expect(page.getByRole('button', { name: /actions$/ })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Set up year' })).toHaveCount(0);
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

			test('fits the width', async ({ page }) => {
				await login(page);
				await page.goto('/calendar');
				await expect(page.locator('main table')).toBeVisible();
				await expectNoHorizontalScroll(page);
			});

			// The day menu (block and unblock) and Set up year show from `md` up and not on a
			// phone (stories 104 and 105).
			test('the day menu and Set up year show by size', async ({ page }) => {
				await login(page);
				await page.goto('/calendar');
				const dayMenu = page.getByRole('button', { name: /actions$/ });
				const setUpYear = page.getByRole('button', { name: 'Set up year' });
				if (isPhone) {
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

test.describe('the Lesson editor on a laptop', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('Back returns to the screen that opened it, or to the Course page when opened directly', async ({
		page
	}) => {
		await openLessonFromCourses(page);
		const lessonUrl = page.url();
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL(/\/courses\/[^/?]+\?topic=/);

		// A full load has no earlier page in the app.
		await page.goto(lessonUrl);
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL(/\/courses\/[^/?]+\?topic=/);
		await expect(page.getByRole('link', { name: 'Speed', exact: true })).toBeVisible();
	});

	test('the page bar steps through the Topic with the controls and [ ]', async ({ page }) => {
		await openLessonFromCourses(page);
		const previous = page.getByRole('button', { name: 'Previous Lesson' });
		const next = page.getByRole('button', { name: 'Next Lesson' });
		await expect(page.getByText(/^Lesson 1 of \d+$/)).toBeVisible();
		await expect(previous).toBeDisabled();
		await expect(next).toBeEnabled();

		// Stepping replaces the history entry: two steps, one Back out.
		await next.click();
		await expect(page.getByText(/^Lesson 2 of \d+$/)).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Lesson title' })).toHaveValue('Motion');
		await page.keyboard.press('[');
		await expect(page.getByText(/^Lesson 1 of \d+$/)).toBeVisible();
		await page.keyboard.press(']');
		await expect(page.getByText(/^Lesson 2 of \d+$/)).toBeVisible();

		// The last Lesson has no next, and `]` there does nothing.
		while (await next.isEnabled()) await page.keyboard.press(']');
		const last = await page.getByText(/^Lesson \d+ of \d+$/).innerText();
		expect(last).toMatch(/^Lesson (\d+) of \1$/);
		await page.keyboard.press(']');
		await expect(page.getByText(last)).toBeVisible();

		// A field with focus keeps the keys.
		const title = page.getByRole('textbox', { name: 'Lesson title' });
		const typed = await title.inputValue();
		await title.click();
		await page.keyboard.press('[');
		await expect(title).toHaveValue(`${typed}[`);
		await title.fill(typed);
		await title.blur();

		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL(/\/courses\/[^/?]+\?topic=/);
	});

	test('a title edit followed at once by the breadcrumb is saved', async ({ page }) => {
		await openLessonFromCourses(page);
		const title = page.getByRole('textbox', { name: 'Lesson title' });
		await title.fill('Speed up');
		await page.getByRole('link', { name: /KS3 Science/ }).click();
		await expect(page.getByRole('link', { name: 'Speed up', exact: true })).toBeVisible();

		// Put the title back for the files that follow.
		await page.getByRole('link', { name: 'Speed up', exact: true }).click();
		await page.getByRole('textbox', { name: 'Lesson title' }).fill('Speed');
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page.getByRole('link', { name: 'Speed', exact: true })).toBeVisible();
	});

	test('a Topic move keeps the page and the breadcrumb follows the new Topic', async ({ page }) => {
		await openLessonFromCourses(page);
		const url = page.url();
		const breadcrumb = page.getByRole('link', { name: /KS3 Science/ });
		await page.getByLabel('Topic', { exact: true }).selectOption({ label: 'Materials' });
		await expect(breadcrumb).toContainText('Materials');
		expect(page.url()).toBe(url);

		await page.getByLabel('Topic', { exact: true }).selectOption({ label: 'Forces' });
		await expect(breadcrumb).toContainText('Forces');
	});

	test('the plan toolbar stays in view while a long plan scrolls', async ({ page }) => {
		await openLessonFromCourses(page);
		const plan = page.getByRole('textbox', { name: 'Notes & objectives' });
		await plan.click();
		await page.keyboard.insertText(Array.from({ length: 60 }, (_, i) => `Line ${i}`).join('\n'));
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
		const bold = page.getByRole('button', { name: 'Bold' });
		const box = (await bold.boundingBox())!;
		expect(box.y).toBeGreaterThanOrEqual(0);
		expect(box.y).toBeLessThan(40);

		// Leave the plan as it was for the files that follow.
		await plan.click();
		await page.keyboard.press('Control+a');
		await page.keyboard.press('Delete');
		await page.getByRole('button', { name: 'Back' }).click();
	});
});

test.describe('the Lesson editor for a Standalone Lesson', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	function standaloneLesson(title: string): string {
		return runFixture('create-standalone-lesson', title).trim();
	}

	async function expectToast(page: Page, fragment: string) {
		await expect(page.locator('[data-sonner-toast]').filter({ hasText: fragment })).toBeVisible();
	}

	test('the form has Draft/Planned, Length and Tags, Links and Attachments, and no Topic, steps or Placements', async ({
		page
	}) => {
		const id = standaloneLesson('Revision carousel');
		await login(page);
		await page.goto(`/lessons/${id}`);
		await expectLessonPage(page);

		await expect(page.getByText('Standalone Lesson', { exact: true })).toBeVisible();
		await expect(page.getByRole('radio', { name: 'Planned' })).toBeVisible();
		await expect(page.getByLabel('Length')).toBeVisible();
		await expect(page.getByLabel('Topic', { exact: true })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Next Lesson' })).toHaveCount(0);
		await expect(page.getByText(/^Lesson \d+ of \d+$/)).toHaveCount(0);

		await page.getByRole('button', { name: '+ Add Tag' }).click();
		await page.getByPlaceholder('Tag name').fill('revision');
		await page.getByRole('button', { name: 'Add', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Remove revision' })).toBeVisible();

		await page.getByRole('button', { name: '+ Add Link' }).click();
		await page.getByPlaceholder('Label').fill('Past papers');
		await page.getByPlaceholder('https://…').fill('https://example.com/papers');
		await page.getByRole('button', { name: 'Add', exact: true }).click();
		await expect(page.getByRole('link', { name: 'Past papers' })).toBeVisible();

		await page.getByLabel('Choose a file to attach').setInputFiles({
			name: 'carousel.txt',
			mimeType: 'text/plain',
			buffer: Buffer.from('stations')
		});
		await expect(page.locator('main').getByText('carousel.txt')).toBeVisible();

		// Opened directly, Back goes to Planning.
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL(/\/planning$/);
	});

	test('Delete on a placed Standalone Lesson shows the refusal and keeps it; an unplaced one is deleted', async ({
		page
	}) => {
		const id = standaloneLesson('Placed carousel');
		const date = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
		runFixture('place-lesson', id, '9C/Sc1', date);
		await login(page);
		await page.goto(`/lessons/${id}`);
		await expectLessonPage(page);

		await page.getByRole('button', { name: 'Delete Lesson' }).click();
		await expectToast(page, 'A Placement names this Lesson');
		await expect(page).toHaveURL(`/lessons/${id}`);

		// Every Lesson title on Planning opens the Lesson editor, a placed Standalone one too.
		await page.goto('/planning');
		await page.getByRole('link', { name: 'Placed carousel', exact: true }).click();
		await expect(page).toHaveURL(`/lessons/${id}`);

		runFixture('unplace-lesson', id);
		await page.reload();
		await page.getByRole('button', { name: 'Delete Lesson' }).click();
		await expect(page).toHaveURL(/\/planning$/);
		await expect(page.getByRole('link', { name: 'Placed carousel' })).toHaveCount(0);
	});

	test('an unplaced Standalone Lesson on Planning opens the Lesson editor', async ({ page }) => {
		await login(page);
		await page.goto('/planning');
		await page.getByRole('link', { name: 'Revision carousel', exact: true }).click();
		await expectLessonPage(page);
		await expect(page.getByText('Standalone Lesson', { exact: true })).toBeVisible();
	});
});

test.describe('Detach on the Lesson editor', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('a Lesson in a Topic shows Detach; after it the same Lesson shows the Standalone Lesson form', async ({
		page
	}) => {
		await openCourse(page);
		await page.getByRole('link', { name: 'Forces' }).click();
		await page.getByPlaceholder('New Lesson title — press Enter').fill('Detachable');
		await page.getByPlaceholder('New Lesson title — press Enter').press('Enter');
		// Creating a Lesson neither opens it nor takes the caret out of the box.
		await expect(page.getByRole('link', { name: 'Detachable', exact: true })).toBeVisible();
		await expect(page).toHaveURL(/\/courses\/[^/?]+\?topic=/);
		await expect(page.getByPlaceholder('New Lesson title — press Enter')).toBeFocused();
		await page.getByRole('link', { name: 'Detachable', exact: true }).click();
		await expectLessonPage(page);
		const url = page.url();
		await expect(page.getByLabel('Topic', { exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Detach from Topic' }).click();
		await expect(
			page.locator('[data-sonner-toast]').filter({ hasText: 'Lesson detached from its Topic.' })
		).toBeVisible();
		expect(page.url()).toBe(url);
		await expect(page.getByRole('textbox', { name: 'Lesson title' })).toHaveValue('Detachable');
		await expect(page.getByText('Standalone Lesson', { exact: true })).toBeVisible();
		await expect(page.getByLabel('Topic', { exact: true })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Detach from Topic' })).toHaveCount(0);

		// Leave nothing behind for the files that follow. It was opened from the Courses screen,
		// so Back after the delete returns there.
		await page.getByRole('button', { name: 'Delete Lesson' }).click();
		await expect(page).toHaveURL(/\/courses\/[^/?]+\?topic=/);
		await expect(page.getByRole('link', { name: 'Detachable' })).toHaveCount(0);
	});
});

// A Session page with a Lesson, opened from the first Agenda row that carries one, the way the
// teacher opens it. Returns the address, so a test can reload it or open it directly.
async function openSessionWithLesson(page: Page): Promise<string> {
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

// The box a control gives a touch: its drawn box, and the larger of that and its invisible
// 44 px ::after (see touch-target.ts, which buttons carry; an input instead grows to min-h-11
// on touch). A checkbox is tapped through the label that wraps it (ready-tick.svelte), so that
// label is its hit area.
async function expectBox44(control: Locator, wrapped = false) {
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

async function expectHitArea44(
	page: Page,
	name: string | RegExp,
	role: 'button' | 'link' | 'checkbox'
) {
	await expectBox44(page.getByRole(role, { name }).first(), role === 'checkbox');
}

test.describe('the Session page on a phone', () => {
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	test('fits the width, puts the note first once started, and has 44 px targets', async ({
		page
	}) => {
		const path = await openSessionWithLesson(page);
		await expectNoHorizontalScroll(page);

		const date = path.split('/')[3];
		const started = date <= new Date().toISOString().slice(0, 10);
		const note = await page.locator('[data-note]').boundingBox();
		const plan = await page.locator('[data-plan]').boundingBox();
		expect(note && plan && (started ? note.y < plan.y : plan.y < note.y)).toBe(true);

		await expectHitArea44(page, 'Back', 'button');
		await expectHitArea44(page, 'Open in Lesson editor', 'link');
		await expectHitArea44(page, 'Needs more time', 'button');
	});

	test('Open in Lesson editor shows the read view, and Back returns to the Session page', async ({
		page
	}) => {
		const path = await openSessionWithLesson(page);
		await page.getByRole('link', { name: 'Open in Lesson editor' }).click();
		await expectLessonPage(page);
		await expect(page.getByRole('textbox')).toHaveCount(0);
		await expectNoHorizontalScroll(page);

		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL(path);
		await expect(page.getByLabel('How it went')).toBeVisible();
	});

	test('writes a Session note that a reload keeps', async ({ page }) => {
		await openSessionWithLesson(page);
		const text = `Phone note ${Date.now()}`;
		const field = page.getByLabel('How it went');
		await field.click();
		await field.pressSequentially(text);
		// The note saves on leaving the page, so go Back and return to it.
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL('/');
		await page.goForward();
		await page.reload();
		await expect(page.getByLabel('How it went')).toHaveText(text);
	});
});

for (const [name, viewport] of [
	['tablet portrait', { width: 800, height: 1180 }],
	['tablet landscape', { width: 1280, height: 800 }]
] as const) {
	test.describe(`the Session page on a ${name}`, () => {
		test.use({ viewport, hasTouch: true });

		test('fits the width', async ({ page }) => {
			await openSessionWithLesson(page);
			await expectNoHorizontalScroll(page);
		});
	});
}

test.describe('the Session page on a laptop', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('a reload keeps it, Back with nothing behind goes to the Agenda, and the Lesson editor opens', async ({
		page
	}) => {
		const path = await openSessionWithLesson(page);
		await page.reload();
		await expect(page).toHaveURL(path);
		await expect(page.getByLabel('How it went')).toBeVisible();

		await page.getByRole('link', { name: 'Open in Lesson editor' }).click();
		await expectLessonPage(page);
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL(path);

		await page.getByRole('link', { name: 'Open in Lesson editor' }).click();
		await expectLessonPage(page);

		// Opened directly there is no page behind it.
		await page.goto(path);
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL('/');
	});
});

test.describe('the Courses screen on a laptop', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('a tile shows the Course and opens its page', async ({ page }) => {
		await login(page);
		await page.goto('/courses');
		const tile = page.getByRole('link', { name: /KS3 Science/ });
		await expect(tile).toContainText('Topics');
		await expect(tile).toContainText('Lessons');
		await expect(tile.getByRole('img', { name: /of Lessons Planned/ })).toBeVisible();
		await tile.click();
		await expect(page).toHaveURL(/\/courses\/[^/?]+$/);
	});

	test('typing a name in the New Course tile and pressing Enter opens the new Course', async ({
		page
	}) => {
		await login(page);
		await page.goto('/courses');
		const name = `Tile Course ${Date.now()}`;
		await page.getByPlaceholder('New Course name').fill(name);
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/\/courses\/[^/?]+$/);
		await expect(page.getByRole('heading', { name })).toBeVisible();
	});
});

{
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	for (const [name, use] of [
		['phone', { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch }],
		['tablet portrait', { viewport: { width: 800, height: 1180 }, hasTouch: true }],
		['tablet landscape', { viewport: { width: 1280, height: 800 }, hasTouch: true }]
	] as const) {
		test.describe(`the Courses screen on a ${name}`, () => {
			test.use(use);

			test('fits the width', async ({ page }) => {
				await login(page);
				await page.goto('/courses');
				await expect(page.getByRole('link', { name: /KS3 Science/ })).toBeVisible();
				await expectNoHorizontalScroll(page);
			});
		});
	}
}

test.describe('the Courses screens on a phone write nothing', () => {
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	test('the Courses screen has no New Course tile', async ({ page }) => {
		await login(page);
		await page.goto('/courses');
		await expect(page.getByRole('link', { name: /KS3 Science/ })).toBeVisible();
		await expect(page.getByPlaceholder('New Course name')).toHaveCount(0);
	});

	test('the Course page has no rename, menu, reorder or create control', async ({ page }) => {
		await openCourse(page);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('KS3 Science');
		await expect(page.getByPlaceholder('New Topic name')).toHaveCount(0);
		await expect(page.getByRole('button', { name: /^Rename |actions$/ })).toHaveCount(0);

		await page.getByRole('link', { name: 'Forces' }).click();
		await expect(page.getByRole('link', { name: 'Speed', exact: true })).toBeVisible();
		await expect(page.getByPlaceholder('New Lesson title')).toHaveCount(0);
		await expect(page.getByRole('button', { name: /^Rename |actions$|^Move /i })).toHaveCount(0);
		await expectNoHorizontalScroll(page);
	});
});

test.describe('the Planning table on a laptop', () => {
	// Shorter than the whole stream, so the window scrolls and the headings can be checked.
	test.use({ viewport: { width: 1280, height: 560 } });

	test('the column headings stay in view as the window scrolls', async ({ page }) => {
		await login(page);
		await page.goto('/planning');
		// The files before have built Lessons: the whole stream is longer than the window.
		expect(
			await page.evaluate(
				() => document.documentElement.scrollHeight > document.documentElement.clientHeight
			)
		).toBe(true);
		await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
		const box = (await page.getByRole('columnheader', { name: 'Lesson' }).boundingBox())!;
		expect(box.y).toBeGreaterThanOrEqual(0);
		expect(box.y).toBeLessThan(40);
	});

	test('a click beside the Draft/Planned toggle opens nothing; the title opens the Lesson', async ({
		page
	}) => {
		await login(page);
		await page.goto('/planning');
		const row = page
			.getByRole('row')
			.filter({ has: page.getByRole('link', { name: 'Speed', exact: true }) })
			.first();
		// The corner of the Status cell is beside the toggle and on no control.
		await row
			.getByRole('cell')
			.last()
			.click({ position: { x: 2, y: 2 } });
		await expect(page).toHaveURL(/\/planning/);
		await expect(row).toBeVisible();
		await row.getByRole('link', { name: 'Speed', exact: true }).click();
		await expectLessonPage(page);
	});
});

{
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	for (const [name, use] of [
		['phone', { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch }],
		['tablet portrait', { viewport: { width: 800, height: 1180 }, hasTouch: true }],
		['tablet landscape', { viewport: { width: 1280, height: 800 }, hasTouch: true }]
	] as const) {
		test.describe(`Planning on a ${name}`, () => {
			test.use(use);

			test('fits the width', async ({ page }) => {
				await login(page);
				await page.goto('/planning');
				await expect(page.getByRole('link', { name: 'Speed', exact: true })).toBeVisible();
				await expectNoHorizontalScroll(page);
			});
		});
	}
}

test.describe('the Planning cards on a phone', () => {
	// `defaultBrowserType` would force a new worker inside a describe, so take the other fields.
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	test('one card per Lesson reads its status as a read-only badge, and no toggle shows', async ({
		page
	}) => {
		await login(page);
		await page.goto('/planning');
		await expect(page.getByRole('link', { name: 'Speed', exact: true })).toBeVisible();

		// Below `md` one card per Lesson. Each card carries exactly one Draft/Planned read-only
		// badge: a badge is one status word, where a toggle is the pair Draft and Planned.
		const status = /^(Draft|Planned)$/;
		const cards = page.getByRole('main').getByRole('listitem');
		const count = await cards.count();
		expect(count).toBeGreaterThan(0);
		for (let i = 0; i < count; i++) {
			// Exactly one Draft/Planned badge on the card, and it shows.
			const badge = cards.nth(i).getByText(status);
			await expect(badge).toHaveCount(1);
			await expect(badge).toBeVisible();
		}

		// On a phone the Draft/Planned toggle does not show: Draft and Planned name no button.
		await expect(page.getByRole('button', { name: status })).toHaveCount(0);
		await expectNoHorizontalScroll(page);
	});
});

test.describe('the Class chip row on a phone', () => {
	// The chips must outnumber what a phone can show, so what a sideways swipe scrolls is the
	// row itself — and never the page. `defaultBrowserType` stays out, so no new worker is forced.
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	test('the chips scroll sideways and the page does not', async ({ page }) => {
		await openCourse(page);
		await page.waitForURL(/\/courses\/[^/]+$/);
		const courseId = new URL(page.url()).pathname.split('/').pop()!;
		for (let i = 1; i <= 6; i++) runFixture('create-class', `Filler ${i}`, courseId);

		await page.goto('/planning');
		const chips = page.getByRole('group', { name: 'Filter by Class' });
		await expect(chips.getByRole('button', { name: 'Filler 1' })).toBeVisible();
		expect(await chips.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
		await expectNoHorizontalScroll(page);

		// The Fillers exist to outnumber what a phone shows; after the assertions they go, so
		// the Classes-screen and Class-page describes below read the classes the suite built,
		// and no Fillers.
		for (let i = 1; i <= 6; i++) runFixture('delete-class', `Filler ${i}`);
	});
});

test.describe('the Classes screen on a laptop', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('a tile opens its Class page from its body, and the footer holds its two controls (stories 107–108)', async ({
		page
	}) => {
		await login(page);
		await page.goto('/classes');
		const item = page.getByRole('listitem').filter({ hasText: '9B/Sc1' });
		const tile = item.getByRole('link', { name: /9B\/Sc1/ });
		await expect(tile).toContainText('KS3 Science');
		await expect(tile).toContainText('Runway');
		// The footer sits beside the body link, not inside it: only the body opens the page.
		await expect(item.getByRole('button', { name: 'Assign next Topic' })).toBeVisible();
		await expect(item.getByRole('link', { name: 'Open Class' })).toBeVisible();
		await tile.click();
		await expect(page).toHaveURL(/\/classes\/[^/?]+$/);
	});
});

{
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	for (const [name, use] of [
		['phone', { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch }],
		['tablet portrait', { viewport: { width: 800, height: 1180 }, hasTouch: true }],
		['tablet landscape', { viewport: { width: 1280, height: 800 }, hasTouch: true }]
	] as const) {
		test.describe(`the Classes screen on a ${name}`, () => {
			test.use(use);

			test('fits the width', async ({ page }) => {
				await login(page);
				await page.goto('/classes');
				await expect(page.getByRole('link', { name: /9B\/Sc1/ })).toBeVisible();
				await expectNoHorizontalScroll(page);
			});
		});
	}
}

test.describe('the Classes screen on a phone writes nothing', () => {
	// `defaultBrowserType` stays out, so no new worker is forced (as on the Courses screens).
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	test('no New Class tile and no Assign next Topic; Open Class has a 44 px box (story 109)', async ({
		page
	}) => {
		await login(page);
		await page.goto('/classes');
		await expect(page.getByRole('link', { name: /9B\/Sc1/ })).toBeVisible();
		await expect(page.getByRole('button', { name: 'New Class' })).toBeHidden();
		await expect(page.getByRole('button', { name: 'Assign next Topic' })).toBeHidden();
		await expectHitArea44(page, 'Open Class', 'link');
		await expectNoHorizontalScroll(page);
	});
});

// The Class page (issue #347): Overview and Timetable tabs from `md` up; on a phone Overview
// only, and nothing written there.
async function openClassPage(page: Page) {
	await login(page);
	await page.goto('/classes');
	const href = await page
		.getByRole('link', { name: /9B\/Sc1/ })
		.first()
		.getAttribute('href');
	await page.goto(href as string);
	await expect(page.getByRole('heading', { level: 1, name: '9B/Sc1' })).toBeVisible();
}

test.describe('the Class page on a laptop', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('opens on Overview, and the Timetable tab shows its Slot count and the Timetable', async ({
		page
	}) => {
		await openClassPage(page);
		await expect(page.getByRole('tablist')).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		// Overview first: the Assigned Topics stand beside the progress card, the Timetable
		// not yet.
		await expect(page.getByRole('heading', { name: 'Assigned Topics' })).toBeVisible();
		await expect(page.getByLabel('Timetable as at — pick any date')).toBeHidden();

		await page.getByRole('tab', { name: /^Timetable/ }).click();
		await expect(page.getByRole('tab', { name: /^Timetable/ })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		// The Slot count sits in the tab: 9B/Sc1 holds Mon, Wed and Fri P1.
		await expect(page.getByRole('tab', { name: /^Timetable/ })).toHaveAccessibleName(/3/);
		await expect(page.getByLabel('Timetable as at — pick any date')).toBeVisible();
	});
});

{
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	for (const [name, use] of [
		['phone', { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch }],
		['tablet portrait', { viewport: { width: 800, height: 1180 }, hasTouch: true }],
		['tablet landscape', { viewport: { width: 1280, height: 800 }, hasTouch: true }]
	] as const) {
		test.describe(`the Class page on a ${name}`, () => {
			test.use(use);

			test('fits the width', async ({ page }) => {
				await openClassPage(page);
				await expectNoHorizontalScroll(page);
			});
		});
	}
}

for (const [name, use] of [
	['tablet portrait', { viewport: { width: 800, height: 1180 }, hasTouch: true }],
	['tablet landscape', { viewport: { width: 1280, height: 800 }, hasTouch: true }]
] as const) {
	test.describe(`the Class page on a ${name} can write the Timetable`, () => {
		test.use(use);

		test('the Timetable tab shows, and the teacher can write a Slot', async ({ page }) => {
			await openClassPage(page);
			// The tablist shows from a tablet up (story 115).
			await expect(page.getByRole('tablist')).toBeVisible();
			await page.getByRole('tab', { name: /^Timetable/ }).click();

			// A free cell — Tuesday P1 in Week A. The take is reversible, so this test leaves
			// the Timetable exactly as it found it for the files that follow.
			await expect(page.getByRole('button', { name: /^Week A Tue P1 — empty/ })).toBeVisible();
			await page.getByRole('button', { name: /^Week A Tue P1 — empty/ }).click();
			await expect(
				page.getByRole('button', { name: /^Week A Tue P1 — 9B\/Sc1, click to clear/ })
			).toBeVisible();

			await page.getByRole('button', { name: /^Week A Tue P1 — 9B\/Sc1, click to clear/ }).click();
			await expect(page.getByRole('button', { name: /^Week A Tue P1 — empty/ })).toHaveCount(1);
		});
	});
}

test.describe('the Class page on a phone writes nothing', () => {
	// `defaultBrowserType` stays out, so no new worker is forced (as on the Courses screens).
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	test('no tabs and no Timetable; Overview only, with no reorder or Unassign (story 116)', async ({
		page
	}) => {
		await openClassPage(page);
		// No tabs at all: A chosen Timetable tab on a wider window still shows Overview here.
		await expect(page.getByRole('tab', { name: 'Overview' })).toBeHidden();
		// The Timetable itself is gone, with its "Timetable as at" control.
		await expect(page.getByLabel('Timetable as at — pick any date')).toBeHidden();
		// Overview reads: the progress card and the Assigned Topics, without their controls.
		await expect(page.getByRole('heading', { name: 'Assigned Topics' })).toBeVisible();
		await expect(page.getByRole('button', { name: /^Unassign / })).toBeHidden();
		await expect(page.getByRole('button', { name: /^Move / })).toBeHidden();
		await expect(page.getByRole('button', { name: 'Assign next Topic' })).toBeHidden();
	});
});

// Login and Setup leave the app shell, so these describes stand alone. Setup is reachable with
// no account only, so its tests run in setup-wizard.e2e.ts; Login's run here, where the one
// user already exists.
test.describe('the Login page on a phone (issue #351)', () => {
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	test('the form is flush at the top, with no card frame (story 122)', async ({ page }) => {
		await page.goto('/login');
		await expect(page.getByLabel('Email')).toBeVisible();

		// Below `sm` the card draws no frame and the page no muted backdrop; the form starts at
		// the top of the window, so the keyboard does not push it about. The card's top sits
		// only just below the wordmark; a centred layout would put it well down the window.
		const card = page.locator('[data-slot="card"]');
		await expect(card).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
		await expect(page.locator('main')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
		const box = (await card.boundingBox())!;
		expect(box.y).toBeLessThan(120);

		// No shadow or ring may paint either: the frame would survive a transparent card.
		// v4 writes each box-shadow entry colour-first, so a comma inside a colour never
		// follows a length: the entries split where a comma follows one.
		const painting = await card.evaluate((el: HTMLElement) => {
			const shadow = getComputedStyle(el).boxShadow;
			if (shadow === 'none') return 0;
			const entries = shadow.split(/(?<=px), /);
			return entries.filter((entry) =>
				(entry.match(/[-\d.]+px/g) ?? []).some((px) => parseFloat(px) !== 0)
			).length;
		});
		expect(painting).toBe(0);

		await expectNoHorizontalScroll(page);
	});

	test('on touch the inputs and the button each have a 44 px box (story 124)', async ({ page }) => {
		await page.goto('/login');
		await expectBox44(page.getByLabel('Email'));
		await expectBox44(page.getByLabel('Password'));
		await expectBox44(page.getByRole('button', { name: 'Log in' }));
	});
});

test.describe('the Login page from sm up (issue #351)', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('the centred card is back on the muted background (story 123)', async ({ page }) => {
		await page.goto('/login');
		const card = page.locator('[data-slot="card"]');
		await expect(card).toBeVisible();

		// The card draws its background again, the page its muted backdrop, and the card sits
		// centred in the window again.
		const background = (el: HTMLElement) => getComputedStyle(el).backgroundColor;
		expect(await card.evaluate(background)).not.toBe('rgba(0, 0, 0, 0)');
		expect(await page.locator('main').evaluate(background)).not.toBe('rgba(0, 0, 0, 0)');
		const width = page.viewportSize()!.width;
		const box = (await card.boundingBox())!;
		expect(Math.abs(box.x - (width - box.width) / 2)).toBeLessThanOrEqual(1);
		const centre = (box.y + box.height / 2) / page.viewportSize()!.height;
		expect(centre).toBeGreaterThan(0.3);
		expect(centre).toBeLessThan(0.7);
	});
});

// The flush window closes exactly at `sm` (640 px): a narrower phone size is proven on a phone,
// a laptop size here, and the boundary itself — the range a wider-than-phone tablet landscape
// can land in — is pinned here. The shell's other screens break at `md` instead, so the `sm`
// edge is worth its own test.
test.describe('the Login page at the sm edge (issue #351)', () => {
	test.use({ viewport: { width: 640, height: 720 } });

	test('the card shows from sm up', async ({ page }) => {
		await page.goto('/login');
		const card = page.locator('[data-slot="card"]');
		await expect(card).toBeVisible();
		const background = (el: HTMLElement) => getComputedStyle(el).backgroundColor;
		expect(await card.evaluate(background)).not.toBe('rgba(0, 0, 0, 0)');
		expect(await page.locator('main').evaluate(background)).not.toBe('rgba(0, 0, 0, 0)');
	});
});

// Settings (issue #349): three cards, Change password beside API key and Backup from `lg`,
// one column below. The cards are found by their titles; the layout is checked by geometry,
// the file's way of asserting what the teacher sees without pinning classes or pixels.
{
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	for (const [name, use, oneColumn] of [
		['phone', { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch }, true],
		['tablet portrait', { viewport: { width: 800, height: 1180 }, hasTouch: true }, true],
		// Tablet landscape sits above `lg`, so it shows the laptop's two-column layout.
		['tablet landscape', { viewport: { width: 1280, height: 800 }, hasTouch: true }, false]
	] as const) {
		test.describe(`the Settings page on a ${name} (issue #349)`, () => {
			test.use(use);

			test('fits the width', async ({ page }) => {
				await login(page);
				await page.goto('/settings');
				await expect(
					page.locator('[data-slot="card-title"]').filter({ hasText: 'Change password' })
				).toBeVisible();
				await expectNoHorizontalScroll(page);
			});

			if (oneColumn) {
				test('the cards are in one column', async ({ page }) => {
					await login(page);
					await page.goto('/settings');
					await expectOneColumn(page);
				});
			} else {
				test('the cards are in two columns, as on a laptop', async ({ page }) => {
					await login(page);
					await page.goto('/settings');
					await expectTwoColumns(page);
				});
			}
		});
	}
}

test.describe('the Settings page on a laptop (issue #349)', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('Change password stands beside API key and Backup (story 118)', async ({ page }) => {
		await login(page);
		await page.goto('/settings');
		await expect(
			page.locator('[data-slot="card-title"]').filter({ hasText: 'Change password' })
		).toBeVisible();
		await expectTwoColumns(page);
		await expectNoHorizontalScroll(page);
	});
});
