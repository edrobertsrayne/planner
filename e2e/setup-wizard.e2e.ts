import { test, expect, type Page } from '@playwright/test';

// The wizard can only ever run once — this app has exactly one user (ADR-0001) — so these tests
// share a single browser context and run in a fixed order: the refusals first, because they must
// not be the thing that creates the user, then the successful run, then the post-setup redirects.
test.describe.serial('the first-run wizard', () => {
	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('a deep route redirects to /setup when there is no user', async () => {
		await page.goto('/calendar');
		await expect(page).toHaveURL(/\/setup$/);
	});

	test('a mismatched confirmation is refused and creates no user', async () => {
		await page.goto('/setup');
		await page.getByLabel('Name').fill('Test Teacher');
		await page.getByLabel('Email').fill('teacher@example.com');
		await page.getByLabel('Password', { exact: true }).fill('a-very-long-password');
		await page.getByLabel('Confirm password').fill('a-different-password');
		await page.getByRole('button', { name: 'Create account' }).click();

		await expect(page.getByRole('alert')).toHaveText(/do not match/i);
		await expect(page).toHaveURL(/\/setup$/);

		await page.goto('/calendar');
		await expect(page).toHaveURL(/\/setup$/);
	});

	test('a password below the minimum length is refused and creates no user', async () => {
		await page.goto('/setup');
		await page.getByLabel('Name').fill('Test Teacher');
		await page.getByLabel('Email').fill('teacher@example.com');
		await page.getByLabel('Password', { exact: true }).fill('short1');
		await page.getByLabel('Confirm password').fill('short1');
		await page.getByRole('button', { name: 'Create account' }).click();

		await expect(page.getByRole('alert')).toHaveText(/at least/i);
		await expect(page).toHaveURL(/\/setup$/);

		await page.goto('/calendar');
		await expect(page).toHaveURL(/\/setup$/);
	});

	test('completing the wizard lands on the Agenda already signed in', async () => {
		await page.goto('/setup');
		await page.getByLabel('Name').fill('Test Teacher');
		await page.getByLabel('Email').fill('teacher@example.com');
		await page.getByLabel('Password', { exact: true }).fill('a-very-long-password');
		await page.getByLabel('Confirm password').fill('a-very-long-password');
		await page.getByRole('button', { name: 'Create account' }).click();

		await expect(page).toHaveURL('/');
		await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
	});

	test('/setup redirects away for a signed-in visitor', async () => {
		await page.goto('/setup');
		await expect(page).toHaveURL('/');
	});
});

test('/setup redirects away for a signed-out visitor', async ({ browser }) => {
	const context = await browser.newContext();
	const page = await context.newPage();

	await page.goto('/setup');
	await expect(page).toHaveURL(/\/login/);

	await context.close();
});
