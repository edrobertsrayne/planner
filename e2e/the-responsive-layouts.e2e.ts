import { test, expect, devices, type Page } from '@playwright/test';

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

async function expectNoHorizontalScroll(page: Page) {
	const fits = await page.evaluate(
		() => document.documentElement.scrollWidth <= document.documentElement.clientWidth
	);
	expect(fits).toBe(true);
}

test.describe('the App shell on a laptop', () => {
	test.use({ viewport: { width: 1536, height: 750 } });

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
	test.use({ viewport: { width: 1280, height: 800 }, hasTouch: true });

	test('the Agenda fits the width', async ({ page }) => {
		await login(page);
		await expectNoHorizontalScroll(page);
	});
});

test.describe('the App shell on a tablet in portrait', () => {
	test.use({ viewport: { width: 800, height: 1180 }, hasTouch: true });

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
