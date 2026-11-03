import { test, expect, devices } from '@playwright/test';
import {
	expectHitArea44,
	expectLessonPage,
	expectNoHorizontalScroll,
	login,
	openSessionWithLesson,
	resetTo
} from './helpers.ts';

test.beforeAll(() => resetTo('standard'));

// The Agenda at each size. Touch mode: Playwright's Chromium matches `(pointer: coarse)` as soon
// as `hasTouch` is true; `isMobile` is not needed. Each describe sets its size and pointer with
// `test.use`.
test.describe('the Agenda on a laptop', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('a long Lesson title wraps in full on the Agenda (issue #341)', async ({ page }) => {
		await openSessionWithLesson(page);
		await page.getByRole('link', { name: 'Open in Lesson editor' }).click();
		await expectLessonPage(page);
		const lessonUrl = page.url();
		const title = page.getByRole('textbox', { name: 'Lesson title', exact: true });
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

		// Put the title back for the tests that follow.
		await page.goto(lessonUrl);
		await title.fill(original);
		await page
			.getByRole('navigation', { name: 'Primary' })
			.getByRole('link', { name: 'Agenda' })
			.click();
		await expect(page.getByText(original, { exact: true }).first()).toBeVisible();
	});

	test("a Class chip opens the Class's page, and Back returns to the Agenda as it was", async ({
		page
	}) => {
		await login(page, '/?horizon=28&past=1');
		await page.getByRole('link', { name: '9B/Sc1', exact: true }).first().click();
		await expect(page).toHaveURL(/\/classes\/[^/]+$/);
		await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();

		// Back is the browser's own Back, so the horizon and the look-back stay as they were.
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL('/?horizon=28&past=1');
		await expect(page.getByRole('button', { name: 'Hide the previous 7 days' })).toBeVisible();

		// With no previous page in the app, Back goes to the Classes list.
		await page.goForward();
		await expect(page).toHaveURL(/\/classes\/[^/]+$/);
		await page.reload();
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL('/classes');
	});
});

test.describe('the Agenda on a tablet', () => {
	test.use({ viewport: { width: 800, height: 1180 }, hasTouch: true });

	test('the look-back button keeps a 44 px hit area on touch (issue #341)', async ({ page }) => {
		await login(page);
		// The button is drawn at the shadcn size from `md` up; its hit area comes from the
		// shared touch rule (touch-target.ts).
		await expectHitArea44(page, 'Show the previous 7 days', 'button');
	});
});

test.describe('the Agenda on a phone', () => {
	// `defaultBrowserType` would force a new worker inside a describe, so take the other fields.
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	test('the teacher reads the Agenda, with no Ready tick, and blocks a day by name (phone flow 2)', async ({
		page
	}) => {
		await login(page);
		await expectNoHorizontalScroll(page);

		// The top bar names the screen, so the page heading is out of sight below `md` (story 81)
		// — but it stays in the accessibility tree, so a screen reader still has one heading.
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Agenda');
		await expect(page.getByRole('textbox')).toHaveCount(0);

		// Readiness is written from a tablet up: a phone carries neither the tick nor the heading
		// that names it.
		await expect(page.getByRole('checkbox')).toHaveCount(0);
		const headings = page.getByText('Ready to teach?');
		expect(await headings.count()).toBeGreaterThan(0);
		expect(
			await headings.evaluateAll((els) => els.every((el) => el.checkVisibility() === false))
		).toBe(true);

		// With the Ready column gone there is room to name the day control, so the icon carries its
		// words and is not mistaken for a row's own Block (story 83).
		const blockDay = page.getByRole('button', { name: /^Block \w+day/ }).first();
		await expect(blockDay).toContainText('Block day');
		await expect(blockDay).toBeVisible();
		await expect(blockDay).not.toHaveCSS('opacity', '0');
	});

	test('Plan and the day control keep a 44 px target on touch, and Plan shows without a hover', async ({
		page
	}) => {
		// 9C/Sc1 gets no Topic assigned, so its Tuesday P3 Slot carries no Lesson and its row
		// reads Open Slot in every week (teaching-placement.e2e.ts): a horizon that reaches the
		// next Tuesday always holds one.
		await login(page, '/?horizon=28');
		const plan = page
			.locator('li')
			.filter({ hasText: 'Open Slot' })
			.first()
			.getByRole('link', { name: 'Plan' });
		await expect(plan).toBeVisible();

		// On touch there is no hover to wait for (story 83): the control shows, muted.
		await expect(plan).not.toHaveCSS('opacity', '0');
		await expectHitArea44(page, 'Plan', 'link');
		await expectHitArea44(page, /^Block \w+day/, 'button');
		await expectHitArea44(page, '9B/Sc1', 'link');
	});
});
