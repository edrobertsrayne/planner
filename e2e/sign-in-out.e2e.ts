import { test, expect } from '@playwright/test';
import { EMAIL, PASSWORD, resetTo, signIn } from './helpers.ts';

// Signs in as the one user (ADR-0001) that resetTo('standard') creates, from the Login page the
// guard has already opened: this file is the one that tests the form itself.
test.beforeAll(() => resetTo('standard'));

test('a signed-out visitor to a deep route is sent to /login and returned there after logging in', async ({
	page
}) => {
	await page.goto('/calendar');
	await expect(page).toHaveURL(/\/login\?redirectTo=%2Fcalendar/);

	await signIn(page, EMAIL, PASSWORD);

	await expect(page).toHaveURL('/calendar');
	await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();

	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page).toHaveURL('/login');
});

test('an incorrect password is refused without revealing whether the email was known', async ({
	page
}) => {
	await page.goto('/login');
	await signIn(page, EMAIL, 'the-wrong-password');

	await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.');
	await expect(page).toHaveURL('/login');

	await page.goto('/login');
	await signIn(page, 'nobody@example.com', 'whatever-password');

	await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.');
	await expect(page).toHaveURL('/login');
});

test('logging in, out, and back in again, and the route guard around it', async ({ page }) => {
	await page.goto('/login');
	await signIn(page, EMAIL, PASSWORD);
	await expect(page).toHaveURL('/');

	// A signed-in visitor asking for /login is sent straight back to the Agenda.
	await page.goto('/login');
	await expect(page).toHaveURL('/');

	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page).toHaveURL('/login');

	// The route is protected again now that the session is gone.
	await page.goto('/calendar');
	await expect(page).toHaveURL(/\/login\?redirectTo=%2Fcalendar/);

	await signIn(page, EMAIL, PASSWORD);
	await expect(page).toHaveURL('/calendar');
	await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
});
