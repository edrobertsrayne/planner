import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { BellSchedule, BellTime } from '$lib/bell';
import EventTimetableGrid from './EventTimetableGrid.svelte';

const t = (starts: string, ends: string): BellTime => ({ starts, ends });

// The split day of ADR-0033: Lower is the default, with Lunch after P3; Upper has it after P4.
const lower: BellSchedule = {
	id: 'lower',
	name: 'Lower',
	isDefault: true,
	times: {
		1: t('08:50', '09:50'),
		2: t('09:50', '10:50'),
		8: t('10:50', '11:10'),
		3: t('11:10', '12:10'),
		9: t('12:10', '12:40'),
		4: t('12:40', '13:40'),
		5: t('13:40', '14:40'),
		6: t('14:40', '15:40')
	}
};
const upper: BellSchedule = {
	id: 'upper',
	name: 'Upper',
	isDefault: false,
	times: { ...lower.times, 4: t('12:10', '13:10'), 9: t('13:10', '13:40') }
};

const props = {
	eventId: 'e1',
	eventName: 'Gate duty',
	on: '2026-11-04',
	readOnly: false,
	classSlots: [],
	eventSlots: [],
	labelOf: () => ''
};

// What the form under a cell would post: its position and, for Break or Lunch, its Bell Schedule.
function postOf(button: Element) {
	const form = button.closest('form')!;
	const field = (name: string) =>
		(form.querySelector(`input[name="${name}"]`) as HTMLInputElement | null)?.value;
	return { position: field('position'), scheduleId: field('scheduleId') };
}

describe('the Event Timetable grid', () => {
	test('draws a row per Lunch and a shared Break, each with its times', async () => {
		const screen = await render(EventTimetableGrid, {
			...props,
			bell: { schedules: [lower, upper], classSchedules: {} }
		});

		await expect
			.element(screen.getByRole('rowheader', { name: /Lunch \(Lower\)/ }).first())
			.toHaveTextContent('Lunch (Lower) 12:10–12:40');
		await expect
			.element(screen.getByRole('rowheader', { name: /Lunch \(Upper\)/ }).first())
			.toHaveTextContent('Lunch (Upper) 13:10–13:40');
		await expect
			.element(screen.getByRole('rowheader', { name: /Break/ }).first())
			.toHaveTextContent('Break 10:50–11:10');
	});

	test('a Lunch cell posts its own Bell Schedule, a shared Break the default’s', async () => {
		const screen = await render(EventTimetableGrid, {
			...props,
			bell: { schedules: [lower, upper], classSchedules: {} }
		});

		const lunch = screen
			.getByRole('button', { name: /^Week A Mon Lunch \(Upper\) — empty/ })
			.element();
		expect(postOf(lunch)).toEqual({ position: '9', scheduleId: 'upper' });

		const shared = screen.getByRole('button', { name: /^Week A Mon Break — empty/ }).element();
		expect(postOf(shared)).toEqual({ position: '8', scheduleId: 'lower' });
	});

	test('with no Bell Schedule the day is the six Periods, as before', async () => {
		const screen = await render(EventTimetableGrid, {
			...props,
			bell: { schedules: [], classSchedules: {} }
		});

		const rows = screen
			.getByRole('rowheader')
			.elements()
			.map((e) => e.textContent?.trim());
		const week = ['Before school', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
		expect(rows.slice(0, 7)).toEqual(week);
		expect(rows.slice(7)).toEqual(['After school', ...week, 'After school']);

		const before = screen
			.getByRole('button', { name: /^Week A Mon Before school — empty/ })
			.element();
		expect(postOf(before)).toEqual({ position: '0', scheduleId: '' });
	});
});
