import { test, expect, devices } from '@playwright/test';
import { expectNoHorizontalScroll, openLesson, openLessonFromCourses, resetTo } from './helpers.ts';

test.beforeAll(() => resetTo('standard'));

// The Lesson editor at each size. Touch mode: Playwright's Chromium matches `(pointer: coarse)` as
// soon as `hasTouch` is true; `isMobile` is not needed. Each describe sets its size and pointer
// with `test.use`.
test.describe('the Lesson editor on a laptop', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('the plan toolbar stays in view while a long plan scrolls', async ({ page }) => {
		await openLessonFromCourses(page);
		const plan = page.getByRole('textbox', { name: 'Notes & objectives' });
		// The markdown itself, from the form's hidden field: textContent flattens structure.
		const body = page.locator('#lesson-form [name="body"]');
		const original = await body.inputValue();
		await plan.click();
		await page.keyboard.insertText(Array.from({ length: 60 }, (_, i) => `Line ${i}`).join('\n'));
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
		await expect(page.getByRole('button', { name: 'Bold' })).toBeInViewport();

		// Leave the plan as it was for the tests that follow, and wait for the save before Back:
		// a write ends by invalidating the page data, and Back clicked inside that patch is lost
		// (the flake family in issue #352).
		await plan.click();
		await page.keyboard.press('Control+a');
		await page.keyboard.press('Delete');
		if (original) await page.keyboard.insertText(original);
		await Promise.all([page.waitForResponse((r) => r.url().includes('updateLesson')), plan.blur()]);
		await expect(body).toHaveValue(original);
		await page.getByRole('button', { name: 'Back' }).click();
	});
});

test.describe('the Lesson editor on a phone', () => {
	// `defaultBrowserType` would force a new worker inside a describe, so take the other fields.
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

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
});
