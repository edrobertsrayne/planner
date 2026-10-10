import { test, expect } from '@playwright/test';
import { resetTo } from './helpers.ts';

// Proves the e2e server reads e2e.db (issue #40). After resetTo('empty') clears e2e.db, every route
// lands on the setup wizard. A server on another database would still hold a user and send the
// page to /login.
test.beforeAll(() => resetTo('empty'));

test('starts with no user, so every route lands on the setup wizard', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/setup$/);
});
