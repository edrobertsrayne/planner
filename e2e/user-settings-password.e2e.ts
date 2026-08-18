import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// This changes the one user's password, so it must be the last file the suite runs — every
// earlier file relies on the credentials the wizard test (issue #41) set up. File named to sort
// after sign-in-out.e2e.ts for the same single-worker ordering reason documented there.
const EMAIL = 'teacher@example.com';
const PASSWORD = 'a-very-long-password';
const NEW_PASSWORD = 'a-different-very-long-password';

async function login(page: Page, email: string, password: string) {
	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Log in' }).click();
}

async function changePassword(page: Page, current: string, next: string, confirm: string) {
	await page.goto('/settings');
	await page.getByLabel('Current password').fill(current);
	await page.getByLabel('New password', { exact: true }).fill(next);
	await page.getByLabel('Confirm new password').fill(confirm);
	await page.getByRole('button', { name: 'Change password' }).click();
}

test.describe.serial('changing the password from Settings', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await login(page, EMAIL, PASSWORD);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('a mismatched confirmation is refused and changes nothing', async () => {
		await changePassword(page, PASSWORD, NEW_PASSWORD, 'something-else-entirely');

		await expect(page.getByRole('alert')).toHaveText('The two passwords do not match.');

		await page.getByRole('button', { name: 'Log out' }).click();
		await login(page, EMAIL, PASSWORD);
		await expect(page).toHaveURL('/');
	});

	test('an incorrect current password is refused and changes nothing', async () => {
		await changePassword(page, 'the-wrong-password', NEW_PASSWORD, NEW_PASSWORD);

		await expect(page.getByRole('alert')).toHaveText('Current password is incorrect.');

		await page.getByRole('button', { name: 'Log out' }).click();
		await login(page, EMAIL, PASSWORD);
		await expect(page).toHaveURL('/');
	});

	test('changing the password reports success, evicts other sessions, and swaps which password works', async () => {
		// The reason to change a password here is a session left open on a school machine — that
		// second session must be logged out by the change, not merely told about it.
		const otherContext: BrowserContext = await page.context().browser()!.newContext();
		const otherPage = await otherContext.newPage();
		await login(otherPage, EMAIL, PASSWORD);
		await expect(otherPage.getByRole('button', { name: 'Log out' })).toBeVisible();

		await changePassword(page, PASSWORD, NEW_PASSWORD, NEW_PASSWORD);
		await expect(page.getByRole('status')).toHaveText('Password changed.');

		await otherPage.reload();
		await expect(otherPage).toHaveURL(/\/login/);
		await otherContext.close();

		await page.getByRole('button', { name: 'Log out' }).click();
		await expect(page).toHaveURL('/login');

		await login(page, EMAIL, PASSWORD);
		await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.');

		await login(page, EMAIL, NEW_PASSWORD);
		await expect(page).toHaveURL('/');
	});
});
