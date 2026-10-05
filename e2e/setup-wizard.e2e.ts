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

	test('Create account is the page, with Restore from a Backup behind a link (issue #350)', async () => {
		await page.goto('/setup');
		await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
		await expect(page.getByText('Moving from another planner?')).toBeVisible();

		// The link under the card swaps the card for the Restore form, whose instructions sit
		// under the file field (story 121).
		await page.getByRole('button', { name: 'Restore from a Backup' }).click();
		await expect(page.getByLabel('Backup file')).toBeVisible();
		await expect(page.getByText('Choose the file that Back up saved there')).toBeVisible();
		await expect(page.getByText('Set up Planner', { exact: true })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Create account' })).toHaveCount(0);

		// The link back swaps the Create account form in again.
		await page.getByRole('button', { name: 'Set up a new planner instead' }).click();
		await expect(page.getByLabel('Name')).toBeVisible();
		await expect(page.getByLabel('Backup file')).toHaveCount(0);
	});

	test('a file that is not a Backup is refused while restoring (issue #350)', async () => {
		await page.goto('/setup');
		await page.getByRole('button', { name: 'Restore from a Backup' }).click();
		await page.getByLabel('Backup file').setInputFiles({
			name: 'notes.tar',
			mimeType: 'application/x-tar',
			buffer: Buffer.from('these are not planner data')
		});
		await page.getByRole('button', { name: 'Restore', exact: true }).click();
		await expect(page.getByRole('alert')).toContainText('not a Backup');
		// The refusal leaves the Restore form open, error and all.
		await expect(page.getByLabel('Backup file')).toBeVisible();
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
