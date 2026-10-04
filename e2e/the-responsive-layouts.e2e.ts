import { test, expect, type Page } from '@playwright/test';

// Runs after the-planning-api/ and before user-settings-password.e2e.ts, for the suite's
// single-worker ordering (see isolation.e2e.ts). Reads the one user and the KS3 Science course
// that earlier files built, and creates nothing.
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
});

test.describe('the laptop layout (mouse)', () => {
	test.use({ viewport: { width: 1536, height: 750 } });

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
