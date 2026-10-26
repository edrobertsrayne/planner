import { test, expect, devices, type Page } from '@playwright/test';
import { expectNoHorizontalScroll, login, resetTo } from './helpers.ts';

test.beforeAll(() => resetTo('standard'));

// Settings (issue #349): below `lg` Change password, API key and Backup stand in one column, API
// key under Change password and Backup under API key; from `lg` the password card stands beside the
// right column. The cards are found by their titles; every field of the shape is asserted, so a
// layout that reads two ways cannot slip through either check.

// The geometry of the three cards, read from the page. `null` names a card that is not there.
async function settingsGeometry(page: Page) {
	// The card title is a div, not a heading element; wait for the cards before measuring.
	await expect(
		page.locator('[data-slot="card-title"]').filter({ hasText: 'Change password' })
	).toBeVisible();
	return page.evaluate(() => {
		const cardWith = (text: string) =>
			[...document.querySelectorAll('[data-slot="card"]')].find((card) =>
				card.querySelector('[data-slot="card-title"]')?.textContent?.includes(text)
			) as HTMLElement | undefined;
		const password = cardWith('Change password');
		const apiKey = cardWith('API key');
		const backup = cardWith('Backup');
		if (!password || !apiKey || !backup) return null;
		const box = (el: HTMLElement) => el.getBoundingClientRect();
		const sameLeft = (a: HTMLElement, b: HTMLElement) => Math.abs(box(a).left - box(b).left) < 1;
		const stacked = (a: HTMLElement, b: HTMLElement) =>
			sameLeft(a, b) && box(b).top > box(a).top && box(a).bottom <= box(b).top + 1;
		return {
			// One column: API key under Change password, Backup under API key.
			passwordFirst: sameLeft(apiKey, password) && stacked(password, apiKey),
			backupUnderApiKey: stacked(apiKey, backup),
			// Two columns: password on the left, API key and Backup stacked on the right, and API
			// key level with the top of the password card.
			passwordLeft: box(apiKey).left > box(password).left,
			apiKeyBeside: Math.abs(box(apiKey).top - box(password).top) < 8,
			backupStacked: stacked(apiKey, backup)
		};
	});
}

async function expectOneColumn(page: Page) {
	expect(await settingsGeometry(page)).toEqual({
		passwordFirst: true,
		backupUnderApiKey: true,
		passwordLeft: false,
		apiKeyBeside: false,
		backupStacked: true
	});
}

async function expectTwoColumns(page: Page) {
	expect(await settingsGeometry(page)).toEqual({
		passwordFirst: false,
		backupUnderApiKey: true,
		passwordLeft: true,
		apiKeyBeside: true,
		backupStacked: true
	});
}

{
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	for (const [name, use, oneColumn] of [
		['phone', { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch }, true],
		['tablet portrait', { viewport: { width: 800, height: 1180 }, hasTouch: true }, true],
		// Tablet landscape sits above `lg`, so it shows the laptop's two-column layout.
		['tablet landscape', { viewport: { width: 1280, height: 800 }, hasTouch: true }, false]
	] as const) {
		test.describe(`the Settings page on a ${name} (issue #349)`, () => {
			test.use(use);

			test(
				oneColumn
					? 'fits the width, with the cards in one column'
					: 'fits the width, with the cards in two columns, as on a laptop',
				async ({ page }) => {
					await login(page, '/settings');
					if (oneColumn) await expectOneColumn(page);
					else await expectTwoColumns(page);
					await expectNoHorizontalScroll(page);
				}
			);
		});
	}
}

test.describe('the Settings page on a laptop (issue #349)', () => {
	test.use({ viewport: { width: 1280, height: 720 } });

	test('Change password stands beside API key and Backup (story 118)', async ({ page }) => {
		await login(page, '/settings');
		await expect(
			page.locator('[data-slot="card-title"]').filter({ hasText: 'Change password' })
		).toBeVisible();
		await expectTwoColumns(page);
		await expectNoHorizontalScroll(page);
	});
});
