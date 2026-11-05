import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import EventNotes from './EventNotes.svelte';

const occ = (
	date: string,
	note: string | null = null,
	position = 5,
	room: string | null = null
) => ({
	date,
	position,
	room,
	note
});

const occurrences = [
	occ('2026-10-07', 'Set up the group'),
	occ('2026-10-21', 'Agreed weekly check-ins'),
	occ('2026-11-04', null, 5, 'S4'),
	occ('2026-11-18', 'Bring the tracker')
];

const props = { eventId: 'e1', occurrences, today: '2026-11-04', focus: null, editable: true };

describe('the Event Notes tab', () => {
	test('opens on the next date, ready to plan, with the earlier note beside it', async () => {
		const screen = await render(EventNotes, props);
		await expect.element(screen.getByText('Wednesday 4 November')).toBeVisible();
		await expect.element(screen.getByPlaceholder('Plan this date')).toHaveValue('');
		await expect.element(screen.getByText('Agreed weekly check-ins')).toBeVisible();
		await expect.element(screen.getByText('Bring the tracker')).not.toBeInTheDocument();
	});

	test('shows one date at a time: choosing another date swaps the note', async () => {
		const screen = await render(EventNotes, props);
		await screen.getByRole('button', { name: /Wednesday 18 November/ }).click();
		await expect.element(screen.getByRole('textbox')).toHaveValue('Bring the tracker');
		await expect.element(screen.getByRole('textbox')).toHaveAttribute('name', 'note');
		expect(screen.getByRole('textbox').elements()).toHaveLength(1);
	});

	test('a date that has passed is logged, not planned', async () => {
		const screen = await render(EventNotes, props);
		await screen.getByRole('button', { name: /Wednesday 21 October/ }).click();
		await expect.element(screen.getByRole('textbox')).toHaveValue('Agreed weekly check-ins');
		await screen.getByRole('button', { name: /Wednesday 7 October/ }).click();
		await expect.element(screen.getByPlaceholder('Log this date')).toBeVisible();
	});

	test('marks the dates that already carry a note', async () => {
		const screen = await render(EventNotes, props);
		await expect
			.element(screen.getByRole('button', { name: /Wednesday 18 November.*has a note/ }))
			.toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: /Wednesday 4 November.*has a note/ }))
			.not.toBeInTheDocument();
	});

	test('opens on the date a link names', async () => {
		const screen = await render(EventNotes, { ...props, focus: '2026-10-21' });
		await expect.element(screen.getByRole('textbox')).toHaveValue('Agreed weekly check-ins');
	});

	test('on a phone the note is read, not edited', async () => {
		const screen = await render(EventNotes, { ...props, focus: '2026-11-18', editable: false });
		await expect.element(screen.getByText('Bring the tracker')).toBeVisible();
		expect(page.getByRole('textbox').elements()).toHaveLength(0);
	});

	test('an Event with no dates says so', async () => {
		const screen = await render(EventNotes, { ...props, occurrences: [] });
		await expect.element(screen.getByText(/No dates yet/)).toBeVisible();
	});
});
