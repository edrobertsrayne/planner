import { test, expect } from '@playwright/test';
import { login, resetTo } from './helpers.ts';

test.beforeAll(() => resetTo('standard'));

// An Event is a recurring commitment that is not a lesson (ADR-0029). It holds a position no Class
// holds, so Before school is used here: only an Event can take it, whatever the fixture timetables.
test.describe.serial('an Event on a laptop', () => {
	test.use({ viewport: { width: 1280, height: 900 } });

	test('is created, placed on the Timetable, noted, and seen on the other screens', async ({
		page
	}) => {
		await login(page, '/events');
		await page.getByRole('button', { name: 'New Event' }).first().click();
		await page.getByLabel('Name').fill('Maths clinic');
		await page.getByRole('button', { name: 'Create Event' }).click();

		// A new Event has no Slot, so it opens on its Timetable and stays there as Slots are placed.
		await expect(page.getByRole('heading', { name: 'Maths clinic' })).toBeVisible();
		for (const week of ['A', 'B']) {
			for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
				await page
					.getByRole('button', { name: new RegExp(`^Week ${week} ${day} Before school`) })
					.click();
				await expect(
					page.getByRole('button', {
						name: new RegExp(`^Week ${week} ${day} Before school — Maths clinic, click to clear`)
					})
				).toBeVisible();
			}
		}
		// A Period too: the fixture Classes hold P1 and P3, so Week A Mon P6 is free.
		await page.getByRole('button', { name: /^Week A Mon P6/ }).click();
		await expect(page.getByRole('tab', { name: /Timetable/ })).toHaveText(/11/);

		// The Notes tab lists the dates; a note is saved when the box is left.
		await page.getByRole('tab', { name: 'Notes' }).click();
		await expect(page.getByText('Write about the group, never a named pupil')).toBeVisible();
		const box = page.getByPlaceholder('Plan this date').first();
		await box.fill('Past paper Q4 to Q6');
		await box.blur();
		await page.reload();
		await expect(page.locator('textarea').first()).toHaveValue('Past paper Q4 to Q6');

		// One date shows at a time; another date is chosen from the strip, and its note is kept apart.
		await expect(page.locator('textarea')).toHaveCount(1);
		const later = page.getByRole('group', { name: 'Dates' }).getByRole('button').nth(1);
		await later.click();
		await expect(page.getByPlaceholder(/(Plan|Log) this date/)).toHaveValue('');
		await page.getByPlaceholder(/(Plan|Log) this date/).fill('Mock paper');
		await page.getByPlaceholder(/(Plan|Log) this date/).blur();
		await page.reload();
		await later.click();
		await expect(page.locator('textarea')).toHaveValue('Mock paper');
		await expect(page.getByText('Past paper Q4 to Q6')).toBeVisible();

		// The Calendar draws the Event in its Before school band; the Agenda lists it.
		await page.goto('/calendar');
		const tile = page.getByRole('link', { name: /Maths clinic/ }).first();
		await expect(tile).toBeVisible();
		// The tile opens the Event on its own date: the URL names the card, and the card is in view.
		await tile.click();
		await expect(page).toHaveURL(/\?date=(\d{4}-\d{2}-\d{2})#date-\1$/);
		const date = new URL(page.url()).searchParams.get('date');
		await expect(page.locator(`#date-${date}`)).toBeInViewport();
		await page.goto('/calendar');
		await page.goto('/');
		await expect(page.getByRole('link', { name: /Maths clinic/ }).first()).toBeVisible();
	});

	test('an Event over adjacent Periods is one tile and one Agenda row', async ({ page }) => {
		await login(page, '/events');
		await page.getByRole('button', { name: 'New Event' }).first().click();
		await page.getByLabel('Name').fill('Staff briefing');
		await page.getByRole('button', { name: 'Create Event' }).click();
		await expect(page.getByRole('heading', { name: 'Staff briefing' })).toBeVisible();
		// The fixture Classes hold P1 and Tuesday P3, so Wednesday P5 and P6 are free in both weeks.
		for (const week of ['A', 'B']) {
			for (const period of ['P5', 'P6']) {
				await page.getByRole('button', { name: new RegExp(`^Week ${week} Wed ${period}`) }).click();
				await expect(
					page.getByRole('button', {
						name: new RegExp(`^Week ${week} Wed ${period} — Staff briefing, click to clear`)
					})
				).toBeVisible();
			}
		}

		// The Calendar draws one tile over both Periods, not one in each.
		await page.goto('/calendar');
		await expect(page.getByRole('link', { name: /Staff briefing/ })).toHaveCount(1);

		// The Agenda gives each date one row, over both Periods, with one place to write the note.
		await page.goto('/');
		const rows = page.locator('li').filter({ hasText: 'Staff briefing' });
		await expect(rows.first()).toBeVisible();
		await expect(rows.filter({ hasText: 'P5–P6' })).toHaveCount(await rows.count());
		await expect(page.getByRole('link', { name: 'Add plan' }).first()).toBeVisible();

		// Leave no Event behind: the next test deletes its own and expects the list empty.
		await page.goto('/events');
		await page.getByRole('link', { name: /Staff briefing/ }).click();
		await page.getByRole('button', { name: 'Delete Event' }).click();
		await page
			.getByRole('button', { name: /^Delete/ })
			.last()
			.click();
		await expect(page).toHaveURL(/\/events$/);
	});

	test('a position an Event holds is locked on a Class page', async ({ page }) => {
		await login(page, '/classes');
		await page
			.getByRole('link', { name: /9C\/Sc1/ })
			.first()
			.click();
		await page.getByRole('tab', { name: /Timetable/ }).click();
		await expect(page.getByLabel('Week A Mon P6 — held by Maths clinic')).toBeVisible();
	});

	test('deleting an Event asks first, then frees its positions', async ({ page }) => {
		await login(page, '/events');
		await page.getByRole('link', { name: /Maths clinic/ }).click();
		await page.getByRole('button', { name: 'Delete Event' }).click();
		await expect(page.getByText(/Its Timetable positions and 1 note go with it/)).toBeVisible();
		await page
			.getByRole('button', { name: /^Delete/ })
			.last()
			.click();
		await expect(page).toHaveURL(/\/events$/);
		await expect(page.getByText('No Events yet')).toBeVisible();
	});
});

test.describe('an Event on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('has no New Event tile', async ({ page }) => {
		await login(page, '/events');
		await expect(page.getByRole('button', { name: 'New Event' })).toBeHidden();
	});
});
