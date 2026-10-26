import { test, expect, devices } from '@playwright/test';
import { expectNoHorizontalScroll, login, openCourse, resetTo } from './helpers.ts';

test.beforeAll(() => resetTo('standard'));

// The Planning table and cards at each size. Touch mode: Playwright's Chromium matches
// `(pointer: coarse)` as soon as `hasTouch` is true; `isMobile` is not needed. Each describe sets
// its size and pointer with `test.use`.
//
// It leaves the nine `Extra Lesson` Lessons it types into Forces.
test.describe('the Planning table on a laptop', () => {
	// Shorter than the whole stream, so the window scrolls and the headings can be checked.
	test.use({ viewport: { width: 1280, height: 560 } });

	test('the column headings stay in view as the window scrolls', async ({ page }) => {
		// Enough Lessons that the whole stream is longer than the window.
		await openCourse(page);
		await page.getByRole('link', { name: 'Forces' }).click();
		const newLesson = page.getByPlaceholder('New Lesson title — press Enter');
		for (let i = 1; i <= 9; i++) {
			await newLesson.fill(`Extra Lesson ${i}`);
			await newLesson.press('Enter');
			await expect(
				page.getByRole('link', { name: `Extra Lesson ${i}`, exact: true })
			).toBeVisible();
		}
		await page.goto('/planning');
		expect(
			await page.evaluate(
				() => document.documentElement.scrollHeight > document.documentElement.clientHeight
			)
		).toBe(true);
		await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
		await expect(page.getByRole('columnheader', { name: 'Lesson' })).toBeInViewport();
	});
});

{
	for (const [name, use] of [
		['tablet portrait', { viewport: { width: 800, height: 1180 }, hasTouch: true }],
		['tablet landscape', { viewport: { width: 1280, height: 800 }, hasTouch: true }]
	] as const) {
		test.describe(`the Planning table on a ${name}`, () => {
			test.use(use);

			test('fits the width', async ({ page }) => {
				await login(page, '/planning');
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
		await login(page, '/planning');
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
