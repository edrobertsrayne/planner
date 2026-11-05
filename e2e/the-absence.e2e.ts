import { test, expect, type Page } from '@playwright/test';
import { EMAIL, PASSWORD, resetTo, signIn } from './helpers.ts';

test.beforeAll(() => resetTo('standard'));

// An Absence and its Cover (ADR-0030): blocked from the Agenda, a Cover set from the panel's lines,
// written in the Lesson editor, and taken back when Back leaves it blank.
test.describe.serial('an Absence and its Cover', () => {
	let page: Page;
	const panel = () => page.locator('section').filter({ hasText: 'Absent' }).first();

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await page.goto('/login');
		await signIn(page, EMAIL, PASSWORD);
		await expect(page).toHaveURL('/');
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('a day blocked as an Absence reads Absent and lists each Class it takes', async () => {
		const day = page
			.locator('section')
			.filter({ has: page.locator('li') })
			.first();
		const lessons = await day.locator('li').count();
		await day.getByRole('button', { name: /^Block \w+day/ }).click();
		await page.getByRole('checkbox', { name: /I'm absent/ }).check();
		await page.getByRole('button', { name: 'Block day', exact: true }).click();

		await expect(panel()).toContainText('Absent');
		await expect(panel().locator('li')).toHaveCount(lessons);
		await expect(panel().getByRole('button', { name: /^Set cover/ })).toHaveCount(lessons);
	});

	test('a Cover left blank is taken back by Back, and nothing nags about it', async () => {
		await panel()
			.getByRole('button', { name: /^Set cover/ })
			.first()
			.click();
		await page.getByRole('button', { name: 'Create and open' }).click();

		await expect(page).toHaveURL(/\/lessons\/.+\?cover=/);
		await expect(page.getByText(/^Cover for/)).toBeVisible();
		await page.getByRole('button', { name: 'Back' }).click();

		await expect(page).toHaveURL('/');
		await expect(panel().getByText('No Cover recorded')).not.toHaveCount(0);
		await expect(panel().getByText(/^Cover: /)).toHaveCount(0);
	});

	test('a Cover with a plan stays, shows as a link, and is cleared from the panel', async () => {
		await panel()
			.getByRole('button', { name: /^Set cover/ })
			.first()
			.click();
		await page.getByRole('button', { name: 'Create and open' }).click();
		await page.locator('#lesson-form [name="body"]').evaluate((input: HTMLInputElement) => {
			input.value = 'Read pages 40 to 52';
		});
		await page.getByRole('textbox', { name: 'Title' }).first().click();
		await page.getByRole('button', { name: 'Back' }).click();

		await expect(panel().getByRole('link', { name: /^Cover: / })).toHaveCount(1);
		await panel()
			.getByRole('button', { name: /^Clear the Cover/ })
			.click();
		await expect(panel().getByRole('link', { name: /^Cover: / })).toHaveCount(0);
	});

	test('unblocking the day takes the Absence away', async () => {
		await page.getByRole('button', { name: /^Unblock \w+day/ }).click();
		await expect(page.getByText('Absent')).toHaveCount(0);
	});
});
