import { test, expect } from '@playwright/test';
import { expectToast, login, resetTo } from './helpers.ts';

test.beforeAll(() => resetTo('standard'));

// Assign Topic from a Class tile on the Classes screen; the footer is not there on a phone.
test.describe('Assign Topic on the Classes screen', () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test('assigns a Topic from the tile and shows the result as a toast', async ({ page }) => {
		await login(page, '/classes');
		const tile = page.locator('li').filter({ has: page.getByRole('link', { name: /9C\/Sc1/ }) });

		await tile.getByRole('button', { name: 'Assign Topic to 9C/Sc1' }).click();
		await page.getByRole('menuitem', { name: 'Forces · 0 of 2 in Sequence or Placed' }).click();

		await expectToast(page, '9C/Sc1: Added 2 Lessons from Forces.');
		await expect(tile).toContainText('Forces');
		await expect(tile).toContainText('Speed');

		await tile.getByRole('button', { name: 'Assign Topic to 9C/Sc1' }).click();
		await expect(
			page.getByRole('menuitem', { name: 'Forces · all in Sequence or Placed' })
		).toHaveAttribute('data-disabled', '');
	});
});

test.describe('Assign Topic on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('is not on the Class tiles', async ({ page }) => {
		await login(page, '/classes');
		await expect(page.getByRole('link', { name: /9C\/Sc1/ }).first()).toBeVisible();
		await expect(page.getByRole('button', { name: /Assign Topic to/ }).first()).toBeHidden();
	});
});
