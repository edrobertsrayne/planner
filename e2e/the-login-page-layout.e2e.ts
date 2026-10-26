import { test, expect, devices, type Page } from '@playwright/test';
import { expectBox44, expectNoHorizontalScroll, resetTo } from './helpers.ts';

test.beforeAll(() => resetTo('standard'));

// Login leaves the app shell, so this file only reads the page: it signs nobody in. Setup's own
// layouts run in setup-wizard.e2e.ts, where the wizard can still create the user.
//
// The card is centred from `sm` up and flush at the top below it. Both are read from the box the
// teacher sees, never from the styling behind it.
async function expectCardCentred(page: Page) {
	const width = page.viewportSize()!.width;
	const box = (await page.locator('[data-slot="card"]').boundingBox())!;
	expect(Math.abs(box.x - (width - box.width) / 2)).toBeLessThanOrEqual(1);
	const centre = (box.y + box.height / 2) / page.viewportSize()!.height;
	expect(centre).toBeGreaterThan(0.3);
	expect(centre).toBeLessThan(0.7);
}

test.describe('the Login page on a phone (issue #351)', () => {
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	test('the form is flush at the top of a phone (story 122)', async ({ page }) => {
		await page.goto('/login');
		await expect(page.getByLabel('Email')).toBeVisible();

		// Below `sm` the form starts at the top of the window, so the keyboard does not push it
		// about. The card's top sits only just below the wordmark; a centred layout would put it
		// well down the window.
		const box = (await page.locator('[data-slot="card"]').boundingBox())!;
		expect(box.y).toBeLessThan(120);

		await expectNoHorizontalScroll(page);
	});

	test('on touch the inputs and the button each have a 44 px box (story 124)', async ({ page }) => {
		await page.goto('/login');
		await expectBox44(page.getByLabel('Email'));
		await expectBox44(page.getByLabel('Password'));
		await expectBox44(page.getByRole('button', { name: 'Log in' }));
	});
});

test.describe('the Login page from sm up (issue #351)', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('the card sits centred in the window (story 123)', async ({ page }) => {
		await page.goto('/login');
		await expect(page.getByLabel('Email')).toBeVisible();
		await expectCardCentred(page);
	});
});

// The flush window closes exactly at `sm` (640 px): a narrower phone size is proven on a phone,
// a laptop size above, and the boundary itself — the range a wider-than-phone tablet landscape
// can land in — is pinned here. The shell's other screens break at `md` instead, so the `sm`
// edge is worth its own test.
test.describe('the Login page at the sm edge (issue #351)', () => {
	test.use({ viewport: { width: 640, height: 720 } });

	test('the card shows centred at a window exactly sm wide', async ({ page }) => {
		await page.goto('/login');
		await expect(page.getByLabel('Email')).toBeVisible();
		await expectCardCentred(page);
	});
});
