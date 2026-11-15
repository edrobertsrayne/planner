import { devices, expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, login, resetTo, runFixture } from './helpers.ts';

// ADR-0033's split day on the Agenda: Lower is the default, so the day's rows follow its times,
// and 9C/Sc1 follows Upper. Its Tuesday P3 is an Open Slot, so the day holds one teaching row.
test.beforeAll(() => {
	resetTo('standard');
	runFixture('split-day', '9C/Sc1');
});

test.use({ viewport: { width: 1280, height: 720 } });

test('a Session shows its times, and Break and both Lunches sit among the Periods', async ({
	page
}) => {
	await login(page, '/?horizon=28');
	const day = page
		.locator('section')
		.filter({ has: page.getByRole('link', { name: '9C/Sc1', exact: true }) })
		.first();
	const rows = day.locator('li');

	// Before P3, the shared Break; then the Session with the Class's own Bell Schedule's times;
	// then each Lunch at its own start.
	await expect(rows).toHaveCount(4);
	await expect(rows.nth(0)).toContainText('Break 10:50–11:10');
	await expect(rows.nth(1)).toContainText('P3');
	await expect(rows.nth(1)).toContainText('11:15–12:10');
	await expect(rows.nth(1)).toContainText('9C/Sc1');
	await expect(rows.nth(2)).toContainText('Lunch (Lower) 12:10–12:40');
	await expect(rows.nth(3)).toContainText('Lunch (Upper) 13:10–13:40');

	// The times sit inside the Period tile, not spilling into the Class chip beside it.
	const times = rows.nth(1).getByText('11:10–12:10');
	await expect(times).toBeVisible();
	expect(await times.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test.describe('the split day on a phone', () => {
	const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
	test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

	test('the times and both Lunches fit the column', async ({ page }) => {
		await login(page, '/?horizon=28');
		await expectNoHorizontalScroll(page);
		const upperLunch = page.locator('li').filter({ hasText: 'Lunch (Upper)' }).first();
		await expect(upperLunch).toContainText('13:10–13:40');
		await expect(upperLunch).toBeVisible();
	});
});
