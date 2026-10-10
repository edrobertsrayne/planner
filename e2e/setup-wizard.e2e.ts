import { test, expect, devices, type Page } from '@playwright/test';
import { expectBox44, expectNoHorizontalScroll, resetTo } from './helpers.ts';

// The wizard can only ever run once — this app has exactly one user (ADR-0001) — so these tests
// share a single browser context and run in a fixed order: the refusals first, because they must
// not be the thing that creates the user, then the successful run, then the post-setup redirects.
test.beforeAll(() => resetTo('empty'));

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

	// The wizard runs while no account exists, so Setup's layouts can only be checked here.
	// Login's own layout tests stand in the-responsive-layouts.e2e.ts.
	test('Setup shows the centred card from sm up (story 123, issue #351)', async () => {
		await page.goto('/setup');
		const card = page.locator('[data-slot="card"]');
		await expect(card).toBeVisible();

		// From `sm` up the card draws its background, the page its muted backdrop, and the card
		// sits centred in the window.
		const background = (el: HTMLElement) => getComputedStyle(el).backgroundColor;
		expect(await card.evaluate(background)).not.toBe('rgba(0, 0, 0, 0)');
		expect(await page.locator('main').evaluate(background)).not.toBe('rgba(0, 0, 0, 0)');
		const width = page.viewportSize()!.width;
		const box = (await card.boundingBox())!;
		expect(Math.abs(box.x - (width - box.width) / 2)).toBeLessThanOrEqual(1);
	});

	test('Setup is flush on a phone: the form at the top, no card frame (stories 122, 124)', async ({
		browser
	}) => {
		// The shared page keeps the default viewport for the wizard's other tests; the phone
		// context belongs to this test alone.
		const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 8'];
		const context = await browser.newContext({
			viewport,
			userAgent,
			deviceScaleFactor,
			isMobile,
			hasTouch
		});
		const phone = await context.newPage();
		await phone.goto('/setup');
		await expect(phone.getByLabel('Name')).toBeVisible();

		// Below `sm` the card draws no frame and the page no muted backdrop; the form starts at
		// the top of the window, so the keyboard does not push it about. The card's top sits
		// only just below the wordmark; a centred layout would put it well down the window.
		const card = phone.locator('[data-slot="card"]');
		await expect(card).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
		await expect(phone.locator('main')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
		const box = (await card.boundingBox())!;
		expect(box.y).toBeLessThan(120);

		// On touch the inputs and the button each have a 44 px box (story 124). The Restore
		// form gets the same check: the file input is its own variant of the Input component.
		await expectBox44(phone.getByLabel('Name'));
		await expectBox44(phone.getByLabel('Email'));
		await expectBox44(phone.getByRole('button', { name: 'Create account' }));
		await phone.getByRole('button', { name: 'Restore from a Backup' }).click();
		await expect(phone.getByLabel('Backup file')).toBeVisible();
		await expectBox44(phone.getByLabel('Backup file'));
		await expectBox44(phone.getByRole('button', { name: 'Restore', exact: true }));
		await expectNoHorizontalScroll(phone);
		await context.close();
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
