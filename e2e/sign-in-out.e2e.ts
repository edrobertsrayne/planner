import { test, expect } from '@playwright/test';
import { EMAIL, ORIGIN, PASSWORD, resetTo, signIn } from './helpers.ts';

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

// ADR-0011: the form is the only sign-in door, and five failures lock it for a minute. This test
// leaves the server unlocked, so it must stay last in the file.
test("better-auth's sign-in endpoint is closed; five failures lock the form, and the wait clears it", async ({
	page
}) => {
	test.setTimeout(120_000);

	const response = await page.request.post('/api/auth/sign-in/email', {
		data: { email: EMAIL, password: PASSWORD },
		headers: { origin: ORIGIN }
	});
	expect(response.status()).toBe(404);

	// Earlier tests in this file left failures behind; keep trying until the lock answers.
	const wait = 'Too many failed sign-ins. Wait a minute and try again.';
	await page.goto('/login');
	for (let i = 0; i < 6; i++) {
		await signIn(page, EMAIL, 'the-wrong-password');
		if ((await page.getByRole('alert').textContent())?.includes(wait)) break;
		await page.goto('/login');
	}
	await expect(page.getByRole('alert')).toHaveText(wait);

	// Inside the lock the right password is refused too, and before any hash runs.
	await page.goto('/login');
	await signIn(page, EMAIL, PASSWORD);
	await expect(page.getByRole('alert')).toHaveText(wait);

	// After the minute, the count starts again and the right password signs in.
	await page.waitForTimeout(61_000);
	await page.goto('/login');
	await signIn(page, EMAIL, PASSWORD);
	await expect(page).toHaveURL('/');
});
