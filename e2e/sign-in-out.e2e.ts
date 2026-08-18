import { test, expect, type Page } from '@playwright/test';

// Runs after the wizard test (issue #41) has created the one user this app ever has (ADR-0001),
// so it can log in as that user rather than creating its own. File sorts after
// setup-wizard.e2e.ts so the suite's single worker sees the user before this file runs.
const EMAIL = 'teacher@example.com';
const PASSWORD = 'a-very-long-password';

async function login(page: Page, email: string, password: string) {
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Log in' }).click();
}

test('a signed-out visitor to a deep route is sent to /login and returned there after logging in', async ({
	page
}) => {
	await page.goto('/calendar');
	await expect(page).toHaveURL(/\/login\?redirectTo=%2Fcalendar/);

	await login(page, EMAIL, PASSWORD);

	await expect(page).toHaveURL('/calendar');
	await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();

	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page).toHaveURL('/login');
});

test('an incorrect password is refused without revealing whether the email was known', async ({
	page
}) => {
	await page.goto('/login');
	await login(page, EMAIL, 'the-wrong-password');

	await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.');
	await expect(page).toHaveURL('/login');

	await page.goto('/login');
	await login(page, 'nobody@example.com', 'whatever-password');

	await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.');
	await expect(page).toHaveURL('/login');
});

test('logging in, out, and back in again, and the route guard around it', async ({ page }) => {
	await page.goto('/login');
	await login(page, EMAIL, PASSWORD);
	await expect(page).toHaveURL('/');

	// A signed-in visitor asking for /login is sent straight back to the Agenda.
	await page.goto('/login');
	await expect(page).toHaveURL('/');

	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page).toHaveURL('/login');

	// The route is protected again now that the session is gone.
	await page.goto('/calendar');
	await expect(page).toHaveURL(/\/login\?redirectTo=%2Fcalendar/);

	await login(page, EMAIL, PASSWORD);
	await expect(page).toHaveURL('/calendar');
	await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
});
