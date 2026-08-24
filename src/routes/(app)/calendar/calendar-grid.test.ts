import { describe, expect, test } from 'vitest';
import type { CalendarCell } from '$lib/server/planner';
import { PERIODS, toGrid } from './calendar-grid';

function cell(overrides: Partial<CalendarCell>): CalendarCell {
	return {
		date: '2026-08-31',
		periodFrom: 1,
		periodTo: 1,
		classId: 'c1',
		classLabel: '9A/Ph1',
		tone: 0,
		kind: 'lesson',
		lesson: { title: 'Measuring speed', topicName: 'Forces' },
		blockedNote: null,
		slotId: 's1',
		blockedDayId: null,
		blockedSlotId: null,
		...overrides
	};
}

const DATES = ['2026-08-31', '2026-09-01', '2026-09-02'];

describe('toGrid', () => {
	test('Periods down, days across — every date holds a column per Period (issue #90)', () => {
		const grid = toGrid(DATES, []);
		expect(grid).toHaveLength(DATES.length);
		expect(grid.every((row) => row.length === PERIODS.length)).toBe(true);
	});

	test('an empty week is free everywhere', () => {
		const grid = toGrid(DATES, []);
		expect(grid.flat().every((e) => e.type === 'free')).toBe(true);
	});

	test('a multi-Period Lesson starts once and covers the Periods after it', () => {
		const grid = toGrid(DATES, [cell({ periodFrom: 3, periodTo: 5 })]);
		expect(grid[0][2]).toMatchObject({ type: 'start' });
		expect(grid[0][3]).toEqual({ type: 'covered' });
		expect(grid[0][4]).toEqual({ type: 'covered' });
		expect(grid[0][5]).toEqual({ type: 'free' });
	});

	test('a Blocked cell occupies its own Slot position only', () => {
		const grid = toGrid(DATES, [
			cell({ kind: 'blocked', lesson: null, blockedNote: 'Trip', periodFrom: 4, periodTo: 4 })
		]);
		expect(grid[0][3]).toMatchObject({ type: 'start' });
		// A Period that is nobody's Slot stays unmarked — never hatched by proximity.
		expect(grid[0][2]).toEqual({ type: 'free' });
		expect(grid[0][4]).toEqual({ type: 'free' });
	});

	test('cells on dates outside the week are ignored', () => {
		const grid = toGrid(DATES, [cell({ date: '2026-09-07' })]);
		expect(grid.flat().every((e) => e.type === 'free')).toBe(true);
	});

	test('the start entry carries its cell through to the renderer', () => {
		const c = cell({ classLabel: '7X/Sc1', tone: 4 });
		const start = toGrid(DATES, [c])[0][0];
		expect(start).toMatchObject({ type: 'start', cell: c });
	});
});
