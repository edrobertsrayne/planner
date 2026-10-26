import { test, expect, devices } from '@playwright/test';
import { expectNoHorizontalScroll, login, resetTo } from './helpers.ts';

test.beforeAll(() => resetTo('standard'));

// The App shell: the sidebar at each size, the drawer on a phone, and the window as the only
// scroller. Each screen's own layout is read by its own `*-layout` file.
//
// Touch mode: Playwright's Chromium matches `(pointer: coarse)` as soon as `hasTouch` is true;
// `isMobile` is not needed. Each describe sets its size and pointer with `test.use`.
test.describe('the App shell on a laptop', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

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
		await expect(page.locator('header')).toHaveCount(1);
		await expect(page.locator('header')).toBeHidden();
		await expectNoHorizontalScroll(page);
	});

	test('no screen is lit while Settings is open', async ({ page }) => {
		await login(page, '/settings');
		await expect(
			page.getByRole('navigation', { name: 'Primary' }).locator('[aria-current]')
		).toHaveCount(0);
	});

	test('the window is the only scroller', async ({ page }) => {
		await login(page, '/calendar');
		const scrollers = await page.evaluate(
			() =>
				[...document.querySelectorAll('main > *')].filter(
					(el) =>
						getComputedStyle(el).overflowY === 'auto' || getComputedStyle(el).overflowY === 'scroll'
				).length
		);
		expect(scrollers).toBe(0);
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
		await expectNoHorizontalScroll(page);
		expect((await agenda.boundingBox())!.width).toBeLessThan(64);
		await agenda.hover();
		await expect(page.locator('[data-slot=tooltip-content]', { hasText: 'Agenda' })).toBeVisible();
	});
});

test.describe('the App shell on a phone', () => {
	// `defaultBrowserType` would force a new worker inside a describe, so take the other fields.
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	test('the drawer opens from the menu button and goes to the Agenda', async ({ page }) => {
		await login(page, '/calendar');
		await expect(page.getByRole('link', { name: 'Agenda' })).toBeHidden();

		await page.getByRole('button', { name: 'Menu' }).click();
		const drawer = page.getByRole('dialog');
		await expect(drawer.getByRole('link', { name: 'Courses' })).toBeVisible();
		await expect(drawer.getByRole('link', { name: 'Settings' })).toBeVisible();
		await expect(drawer.getByRole('button', { name: 'Log out' })).toBeVisible();
		await expect(drawer.getByText(/^Build /)).toBeVisible();

		// The close button keeps its corner: inside the drawer's top right, a short step from the
		// top and on the far side of its width, where a button put back in the flow would not sit
		// (touch-target.ts must not make a positioned button relative).
		const drawerBox = (await drawer.boundingBox())!;
		const closeBox = (await drawer.getByRole('button', { name: 'Close' }).boundingBox())!;
		expect(closeBox.y - drawerBox.y).toBeLessThan(24);
		expect(closeBox.x - drawerBox.x).toBeGreaterThan(drawerBox.width / 2);

		await drawer.getByRole('link', { name: 'Agenda' }).click();
		await expect(page).toHaveURL('/');
		await expect(drawer).toBeHidden();
	});
});
