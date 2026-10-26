import { test, expect, devices } from '@playwright/test';
import {
	expectHitArea44,
	expectLessonPage,
	expectNoHorizontalScroll,
	openSessionWithLesson,
	resetTo,
	todayIso
} from './helpers.ts';

test.beforeAll(() => resetTo('standard'));

// The Session page at each size. Touch mode: Playwright's Chromium matches `(pointer: coarse)` as
// soon as `hasTouch` is true; `isMobile` is not needed. Each describe sets its size and pointer
// with `test.use`.
//
// It leaves a `Phone note <timestamp>` note behind; everything else it makes it undoes.
test.describe('the Session page on a phone', () => {
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	test('fits the width, puts the note first once started, and has 44 px targets', async ({
		page
	}) => {
		const path = await openSessionWithLesson(page);
		await expectNoHorizontalScroll(page);

		const date = path.split('/')[3];
		const started = date <= todayIso();
		const note = await page.locator('[data-note]').boundingBox();
		const plan = await page.locator('[data-plan]').boundingBox();
		expect(note && plan && (started ? note.y < plan.y : plan.y < note.y)).toBe(true);

		await expectHitArea44(page, 'Back', 'button');
		await expectHitArea44(page, 'Open in Lesson editor', 'link');
		if (started) await expectHitArea44(page, 'Needs more time', 'button');
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

	test('writes a Teaching note that a reload keeps', async ({ page }) => {
		const path = await openSessionWithLesson(page);
		const text = `Phone note ${Date.now()}`;
		const field = page.getByLabel('How it went');
		await field.click();
		await field.pressSequentially(text);
		// The note saves on leaving the page, so go Back and return to it. The reload waits for the
		// forward navigation to land on the Session, or it can reload the page that went Back to.
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page).toHaveURL('/');
		await page.goForward();
		await expect(page).toHaveURL(path);
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
