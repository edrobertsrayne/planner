import { devices, expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, login, resetTo, runFixture } from './helpers.ts';

// ADR-0033's split day on the Agenda: Lower is the default, so the day's rows follow its times,
// and Upper's Lunch is a row of its own. 9C/Sc1's Tuesday P3 is an Open Slot, so the day holds one
// teaching row. The Agenda orders by the times but shows none.
test.beforeAll(() => {
	resetTo('standard');
	runFixture('split-day', '9C/Sc1');
});

test.use({ viewport: { width: 1280, height: 720 } });

test('Break and both Lunches sit among the Periods, with no clock times', async ({ page }) => {
	await login(page, '/?horizon=28');
	const day = page
		.locator('section')
		.filter({ has: page.getByRole('link', { name: '9C/Sc1', exact: true }) })
		.first();
	const rows = day.locator('li');

	// Before P3, the shared Break; then the Session; then each Lunch at its own start.
	await expect(rows).toHaveCount(4);
	await expect(rows.nth(0)).toHaveText('Break');
	await expect(rows.nth(1)).toContainText('P3');
	await expect(rows.nth(1)).toContainText('9C/Sc1');
	await expect(rows.nth(2)).toHaveText('Lunch (Lower)');
	await expect(rows.nth(3)).toHaveText('Lunch (Upper)');
	await expect(day).not.toContainText(/\d\d:\d\d/);
});

test.describe('the split day on a phone', () => {
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	test('both Lunches fit the column', async ({ page }) => {
		await login(page, '/?horizon=28');
		await expectNoHorizontalScroll(page);
		const upperLunch = page.locator('li').filter({ hasText: 'Lunch (Upper)' }).first();
		await expect(upperLunch).toBeVisible();
	});
});
