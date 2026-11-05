import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EventNotes from './EventNotes.svelte';

const occ = (
	date: string,
	note: string | null = null,
	position = 5,
	room: string | null = null
) => ({ date, position, room, note });

const occurrences = [
	occ('2026-10-07', 'Set up the group'),
	occ('2026-10-21', 'Agreed weekly check-ins'),
	occ('2026-11-04', null, 5, 'S4'),
	occ('2026-11-18', 'Bring the tracker')
];

const props = { eventId: 'e1', occurrences, today: '2026-11-04', focus: null };

describe('the Event Notes tab', () => {
	test('opens on the next date, ready to plan, with the earlier note beside it', async () => {
		const screen = await render(EventNotes, props);
		await expect.element(screen.getByRole('combobox', { name: 'Date' })).toHaveValue('2026-11-04');
		await expect.element(screen.getByPlaceholder('Plan this date')).toHaveValue('');
		await expect.element(screen.getByText('Agreed weekly check-ins')).toBeVisible();
		await expect.element(screen.getByText('Bring the tracker')).not.toBeInTheDocument();
	});

	test('lists every date to choose from, marking those with a note', async () => {
		const screen = await render(EventNotes, props);
		const labels = screen
			.getByRole('combobox', { name: 'Date' })
			.getByRole('option')
			.elements()
			.map((e) => e.textContent?.trim());
		expect(labels).toEqual(['● Wed 7 Oct', '● Wed 21 Oct', '○ Wed 4 Nov · next', '● Wed 18 Nov']);
	});

	test('shows one date at a time: choosing another date swaps the note', async () => {
		const screen = await render(EventNotes, props);
		await screen.getByRole('combobox', { name: 'Date' }).selectOptions('2026-11-18');
		await expect.element(screen.getByRole('textbox')).toHaveValue('Bring the tracker');
		expect(screen.getByRole('textbox').elements()).toHaveLength(1);
	});

	test('the arrows step to the earlier and later date, and stop at the ends', async () => {
		const screen = await render(EventNotes, props);
		await screen.getByRole('button', { name: 'Later date' }).click();
		await expect.element(screen.getByRole('textbox')).toHaveValue('Bring the tracker');
		await expect.element(screen.getByRole('button', { name: 'Later date' })).toBeDisabled();
		await screen.getByRole('button', { name: 'Earlier date' }).click();
		await screen.getByRole('button', { name: 'Earlier date' }).click();
		await expect.element(screen.getByRole('textbox')).toHaveValue('Agreed weekly check-ins');
		await screen.getByRole('button', { name: 'Earlier date' }).click();
		await expect.element(screen.getByRole('button', { name: 'Earlier date' })).toBeDisabled();
	});

	test('a date that has passed is logged, not planned', async () => {
		const screen = await render(EventNotes, { ...props, focus: '2026-10-07' });
		await expect.element(screen.getByRole('textbox')).toHaveValue('Set up the group');
		await expect.element(screen.getByPlaceholder('Log this date')).toBeVisible();
	});

	test('Today returns to the next date', async () => {
		const screen = await render(EventNotes, { ...props, focus: '2026-10-07' });
		await screen.getByRole('button', { name: 'Today' }).click();
		await expect.element(screen.getByRole('combobox', { name: 'Date' })).toHaveValue('2026-11-04');
	});

	test('opens on the date a link names', async () => {
		const screen = await render(EventNotes, { ...props, focus: '2026-10-21' });
		await expect.element(screen.getByRole('textbox')).toHaveValue('Agreed weekly check-ins');
	});

	test('an Event with no dates says so', async () => {
		const screen = await render(EventNotes, { ...props, occurrences: [] });
		await expect.element(screen.getByText(/No dates yet/)).toBeVisible();
	});
});
