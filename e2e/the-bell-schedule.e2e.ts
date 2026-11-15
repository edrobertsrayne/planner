import { devices, expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, login, resetTo, runFixture } from './helpers.ts';

// ADR-0033's split day on the Agenda: Lower is the default, so the day's rows follow its times,
// and 9C/Sc1 follows Upper. Its Tuesday P3 is an Open Slot, so the day holds one teaching row, and
// no Event holds Break or Lunch. The Agenda orders by the times but shows none.
test.beforeAll(() => {
	resetTo('standard');
	runFixture('split-day', '9C/Sc1');
});

test.use({ viewport: { width: 1280, height: 720 } });

test('a Session shows no clock times, and a Break or Lunch with nothing in it does not show', async ({
	page
}) => {
	await login(page, '/?horizon=28');
	const day = page
		.locator('section')
		.filter({ has: page.getByRole('link', { name: '9C/Sc1', exact: true }) })
		.first();
	const rows = day.locator('li');

	// The Session, and no Event holds Break or Lunch.
	await expect(rows).toHaveCount(1);
	await expect(rows.nth(0)).toContainText('P3');
	await expect(rows.nth(0)).toContainText('9C/Sc1');
	await expect(day).not.toContainText(/\d\d:\d\d/);
});

test.describe('the split day on a phone', () => {
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	test('the day fits the column', async ({ page }) => {
		await login(page, '/?horizon=28');
		await expectNoHorizontalScroll(page);
		await expect(page.getByRole('link', { name: '9C/Sc1', exact: true }).first()).toBeVisible();
	});
});
