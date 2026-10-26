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

	test('the teacher reads the Agenda and ticks Ready on a row (phone flow 2)', async ({ page }) => {
		await login(page);
		await expectNoHorizontalScroll(page);

		// The top bar names the screen, so the page heading is out of sight below `md` (story 81)
		// — but it stays in the accessibility tree, so a screen reader still has one heading.
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Agenda');

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

		// Put the tick back for the tests that follow.
		await tick();
		await page.reload();
		await expect(tickOf()).not.toBeChecked();
	});

	test('Ready and Plan keep a 44 px target on touch, and Plan shows without a hover', async ({
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
		await expectHitArea44(page, /Ready to teach/, 'checkbox');
	});
});
