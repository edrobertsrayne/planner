import { test, expect } from '@playwright/test';

// Proves the e2e web server runs against a fresh, isolated database (issue #40): a request to any
// route lands on the first-run wizard, because the suite's database has no user in it.
test('starts with no user, so every route lands on the setup wizard', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/setup$/);
});
