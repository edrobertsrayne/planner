import { test, expect, devices } from '@playwright/test';
import { expectNoHorizontalScroll, login, openCourse, resetTo } from './helpers.ts';

test.beforeAll(() => resetTo('standard'));

// The Courses screen and the Course page at each size. Touch mode: Playwright's Chromium matches
// `(pointer: coarse)` as soon as `hasTouch` is true; `isMobile` is not needed. Each describe sets
// its size and pointer with `test.use`.
//
// Playwright counts an element at opacity 0 as visible, so a row control being shown is asserted on
// its opacity: it is the only thing that tells a shown control from a hidden one. The mouse cases
// (hidden until hover or focus) are in renameable-row.svelte.test.ts; touch is checked here.
//
// It leaves the `Tile Course <timestamp>` Course behind; everything else it makes it undoes.
test.describe('the Courses screen on a laptop', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('a tile shows the Course and opens its page', async ({ page }) => {
		await login(page, '/courses');
		const tile = page.getByRole('link', { name: /KS3 Science/ });
		await expect(tile).toContainText('1 Topic');
		await expect(tile).toContainText('2 Lessons');
		await expect(tile.getByRole('img', { name: /of Lessons Planned/ })).toBeVisible();
		await tile.click();
		await expect(page).toHaveURL(/\/courses\/[^/?]+$/);
	});

	test('the New Course tile opens a dialog that creates the Course and opens it', async ({
		page
	}) => {
		await login(page, '/courses');
		await expect(page.getByPlaceholder('New Course name')).toHaveCount(0);
		const name = `Tile Course ${Date.now()}`;
		await page.getByRole('button', { name: 'New Course' }).click();
		await page.getByLabel('Name').fill(name);
		await page.getByRole('button', { name: 'Create Course' }).click();
		await expect(page).toHaveURL(/\/courses\/[^/?]+$/);
		await expect(page.getByRole('heading', { name })).toBeVisible();
	});
});

test.describe('the Courses screen on a tablet', () => {
	test.use({ viewport: { width: 800, height: 1180 }, hasTouch: true });

	test('a row control shows without a hover', async ({ page }) => {
		await openCourse(page);
		const pencil = page.getByRole('button', { name: /^Rename / }).first();
		await expect(pencil).toBeVisible();
		await expect(pencil).not.toHaveCSS('opacity', '0');
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
});

test.describe('the Courses screen on a tablet in landscape', () => {
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
});

test.describe('the Courses screens on a phone write nothing', () => {
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	test('the Courses screen has no New Course tile', async ({ page }) => {
		await login(page, '/courses');
		await expect(page.getByRole('link', { name: /KS3 Science/ })).toBeVisible();
		await expect(page.getByRole('button', { name: 'New Course' })).toBeHidden();
		await expectNoHorizontalScroll(page);
	});

	test('the Course page has no rename, menu, reorder or create control', async ({ page }) => {
		await openCourse(page);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('KS3 Science');
		await expect(page.getByPlaceholder('New Topic name')).toHaveCount(0);
		await expect(page.getByRole('button', { name: /^Rename |actions$/ })).toHaveCount(0);
		await expectNoHorizontalScroll(page);

		await page.getByRole('link', { name: 'Forces' }).click();
		await expect(page.getByRole('link', { name: 'Speed', exact: true })).toBeVisible();
		await expect(page.getByPlaceholder('New Lesson title')).toHaveCount(0);
		await expect(page.getByRole('button', { name: /^Rename |actions$|^Move /i })).toHaveCount(0);
		await expectNoHorizontalScroll(page);
	});
});
