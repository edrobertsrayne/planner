import { test, expect, devices, type Page } from '@playwright/test';
import {
	expectBox44,
	expectHitArea44,
	expectNoHorizontalScroll,
	login,
	openCourse,
	resetTo,
	runFixture
} from './helpers.ts';

test.beforeAll(() => resetTo('standard'));

// The Classes screen, the Class page and its chip row at each size. Touch mode: Playwright's
// Chromium matches `(pointer: coarse)` as soon as `hasTouch` is true; `isMobile` is not needed.
// Each describe sets its size and pointer with `test.use`.
//
// It leaves a `Grip target` Lesson at the end of 9B/Sc1's Sequence; everything else it makes it
// undoes.

// The Class page (issue #347): Overview and Timetable tabs from `md` up; on a phone Overview
// only, and nothing written there.
async function openClassPage(page: Page) {
	await login(page, '/classes');
	const href = await page
		.getByRole('link', { name: /9B\/Sc1/ })
		.first()
		.getAttribute('href');
	await page.goto(href as string);
	await expect(page.getByRole('heading', { level: 1, name: '9B/Sc1' })).toBeVisible();
}

test.describe('the Class page on a tablet in portrait', () => {
	test.use({ viewport: { width: 800, height: 1180 }, hasTouch: true });

	test('the Class tabs and the Sequence drag grips keep a 44 px target on touch', async ({
		page
	}) => {
		// A Lesson of its own at the end of the Sequence, so a grip is always there to measure:
		// on a day 9B/Sc1 has a Slot the queue's own next Lesson is Fixed, and a Fixed Lesson
		// carries no grip (SequenceWeeks.svelte).
		runFixture('add-lesson', '9B/Sc1', 'Grip target');
		await openClassPage(page);
		await expectHitArea44(page, 'Overview', 'tab');
		await page.getByRole('tab', { name: /^Sequence/ }).click();
		await expectBox44(page.getByRole('button', { name: 'Drag Grip target' }));
	});
});

for (const [name, use] of [
	['tablet portrait', { viewport: { width: 800, height: 1180 }, hasTouch: true }],
	['tablet landscape', { viewport: { width: 1280, height: 800 }, hasTouch: true }]
] as const) {
	test.describe(`the Class page on a ${name} can write the Timetable`, () => {
		test.use(use);

		test('fits the width; the Timetable tab shows, and the teacher can write a Slot', async ({
			page
		}) => {
			await openClassPage(page);
			await expectNoHorizontalScroll(page);
			// The tablist shows from a tablet up (story 115).
			await expect(page.getByRole('tablist')).toBeVisible();
			await page.getByRole('tab', { name: /^Timetable/ }).click();

			// A free cell — Tuesday P1 in Week A. The take is reversible, so this test leaves
			// the Timetable exactly as it found it for the tests that follow.
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
		try {
			await page.goto('/planning');
			const chips = page.getByRole('group', { name: 'Filter by Class' });
			await expect(chips.getByRole('button', { name: 'Filler 1' })).toBeVisible();
			expect(await chips.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
			await expectNoHorizontalScroll(page);
		} finally {
			// The Fillers exist to outnumber what a phone shows; they go whatever the assertions
			// did, so no later test reads them as Classes the suite built.
			for (let i = 1; i <= 6; i++) runFixture('delete-class', `Filler ${i}`);
		}
	});
});

test.describe('the Classes screen on a laptop', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('a tile is one link to its Class page, with no footer and no progress bar (stories 86–87)', async ({
		page
	}) => {
		await login(page, '/classes');
		const item = page.getByRole('listitem').filter({ hasText: '9B/Sc1' });
		const tile = item.getByRole('link', { name: /9B\/Sc1/ });
		await expect(tile).toContainText('KS3 Science');
		await expect(tile).toContainText('Runway');
		// The tile is one link: no footer link, no progress bar.
		await expect(item.getByRole('link')).toHaveCount(1);
		await expect(item.getByRole('progressbar')).toHaveCount(0);
		await tile.click();
		await expect(page).toHaveURL(/\/classes\/[^/?]+$/);
	});
});

{
	for (const [name, use] of [
		['tablet portrait', { viewport: { width: 800, height: 1180 }, hasTouch: true }],
		['tablet landscape', { viewport: { width: 1280, height: 800 }, hasTouch: true }]
	] as const) {
		test.describe(`the Classes screen on a ${name}`, () => {
			test.use(use);

			test('fits the width', async ({ page }) => {
				await login(page, '/classes');
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

	test('no New Class tile; the tile body is the link, with a 44 px box (story 109)', async ({
		page
	}) => {
		await login(page, '/classes');
		await expect(page.getByRole('link', { name: /9B\/Sc1/ })).toBeVisible();
		await expect(page.getByRole('button', { name: 'New Class' })).toBeHidden();
		await expectHitArea44(page, /9B\/Sc1/, 'link');
		await expectNoHorizontalScroll(page);
	});
});

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
		// Overview first, with the Sequence tab after the Timetable tab; neither shows yet.
		await expect(page.getByRole('tab', { name: /^Sequence/ })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Next Sessions' })).toBeVisible();
		await expect(page.getByLabel('Timetable as at — pick any date')).toBeHidden();
		await expect(page.getByRole('button', { name: 'Assign Topic' })).toBeHidden();

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

test.describe('the Class page on a phone writes nothing', () => {
	// `defaultBrowserType` stays out, so no new worker is forced (as on the Courses screens).
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	test('no tabs, no Timetable, no Sequence; Overview only (story 116)', async ({ page }) => {
		await openClassPage(page);
		await expectNoHorizontalScroll(page);
		// No tabs at all: A chosen Timetable tab on a wider window still shows Overview here.
		await expect(page.getByRole('tablist')).toBeHidden();
		await expect(page.getByRole('tab', { name: 'Overview' })).toBeHidden();
		// The Timetable itself is gone, with its "Timetable as at" control.
		await expect(page.getByLabel('Timetable as at — pick any date')).toBeHidden();
		// Overview reads. The Sequence tab and its Assign Topic menu are not there.
		await expect(page.getByRole('heading', { name: 'Next Sessions' })).toBeVisible();
		await expect(page.getByText('Runway', { exact: true })).toBeVisible();
		await expect(page.getByRole('progressbar')).toHaveCount(0);
		await expect(page.getByRole('tab', { name: /^Sequence/ })).toBeHidden();
		await expect(page.getByRole('button', { name: 'Assign Topic' })).toBeHidden();
	});
});
