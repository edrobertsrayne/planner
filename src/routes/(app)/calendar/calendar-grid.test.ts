import { describe, expect, test } from 'vitest';
import type { CalendarCell } from '$lib/server/planner';
import { availableSlotLines, blockedSlotLines, PERIODS, toGrid } from './calendar-grid';

function cell(overrides: Partial<CalendarCell> = {}): CalendarCell {
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
		slotIds: ['s1'],
		blockedDayId: null,
		blockedSlotId: null,
		...overrides
	};
}

const DAYS = [
	{ date: '2026-08-31', kind: 'teaching' as const },
	{ date: '2026-09-01', kind: 'teaching' as const },
	{ date: '2026-09-02', kind: 'teaching' as const }
];

describe('toGrid', () => {
	test('Periods down, days across — every date holds a column per Period (issue #90)', () => {
		const grid = toGrid(DAYS, []);
		expect(grid).toHaveLength(DAYS.length);
		expect(grid.every((row) => row.length === PERIODS.length)).toBe(true);
	});

	test('an empty week is free everywhere', () => {
		const grid = toGrid(DAYS, []);
		expect(grid.flat().every((e) => e.type === 'free')).toBe(true);
	});

	test('a multi-Period Lesson starts once and covers the Periods after it', () => {
		const grid = toGrid(DAYS, [cell({ periodFrom: 3, periodTo: 5 })]);
		expect(grid[0][2]).toMatchObject({ type: 'start' });
		expect(grid[0][3]).toEqual({ type: 'covered' });
		expect(grid[0][4]).toEqual({ type: 'covered' });
		expect(grid[0][5]).toEqual({ type: 'free' });
	});

	test('a Blocked cell occupies its own Slot position only', () => {
		const grid = toGrid(DAYS, [
			cell({ kind: 'blocked', lesson: null, blockedNote: 'Trip', periodFrom: 4, periodTo: 4 })
		]);
		expect(grid[0][3]).toMatchObject({ type: 'start' });
		// A Period that is nobody's Slot stays unmarked — never hatched by proximity.
		expect(grid[0][2]).toEqual({ type: 'free' });
		expect(grid[0][4]).toEqual({ type: 'free' });
	});

	test('cells on dates outside the week are ignored', () => {
		const grid = toGrid(DAYS, [cell({ date: '2026-09-07' })]);
		expect(grid.flat().every((e) => e.type === 'free')).toBe(true);
	});

	test('the start entry carries its cell through to the renderer', () => {
		const c = cell({ classLabel: '7X/Sc1', tone: 4 });
		const start = toGrid(DAYS, [c])[0][0];
		expect(start).toMatchObject({ type: 'start', cell: c });
	});
});

describe('availableSlotLines', () => {
	test('a Lesson of one Period offers its one Slot', () => {
		expect(availableSlotLines([cell({ slotIds: ['s1'] })], '2026-08-31')).toEqual([
			{ slotId: 's1', period: 1, classLabel: '9A/Ph1' }
		]);
	});

	test('a Lesson over two Periods offers both Slots, one per Period, in Period order', () => {
		const slots = availableSlotLines(
			[cell({ periodFrom: 3, periodTo: 4, slotIds: ['s3', 's4'] })],
			'2026-08-31'
		);
		expect(slots).toEqual([
			{ slotId: 's3', period: 3, classLabel: '9A/Ph1' },
			{ slotId: 's4', period: 4, classLabel: '9A/Ph1' }
		]);
	});

	test('an Open Slot is offered — the Period is taught even when no Lesson is scheduled', () => {
		expect(availableSlotLines([cell({ kind: 'open', lesson: null })], '2026-08-31')).toEqual([
			{ slotId: 's1', period: 1, classLabel: '9A/Ph1' }
		]);
	});

	test('a Blocked cell offers nothing — its Slot is already gone', () => {
		expect(
			availableSlotLines(
				[cell({ kind: 'blocked', lesson: null, blockedNote: 'Trip' })],
				'2026-08-31'
			)
		).toEqual([]);
	});

	test('a day that is already off — every cell Blocked — offers nothing to block', () => {
		expect(
			availableSlotLines(
				[
					cell({ kind: 'blocked', lesson: null, blockedNote: 'Snow' }),
					cell({
						kind: 'blocked',
						lesson: null,
						classLabel: '9C/Sc1',
						periodFrom: 2,
						slotIds: ['t2']
					})
				],
				'2026-08-31'
			)
		).toEqual([]);
	});

	test('cells on other dates are ignored', () => {
		expect(availableSlotLines([cell({ date: '2026-09-01' })], '2026-08-31')).toEqual([]);
	});

	test('the lines read in Period order across Classes', () => {
		const slots = availableSlotLines(
			[
				cell({ periodFrom: 4, slotIds: ['s4'] }),
				cell({ classLabel: '9C/Sc1', periodFrom: 2, slotIds: ['t2'] })
			],
			'2026-08-31'
		);
		expect(slots.map((s) => s.period)).toEqual([2, 4]);
	});
});

describe('blockedSlotLines', () => {
	test('a Blocked Slot cell yields the line its Unblock needs', () => {
		expect(
			blockedSlotLines(
				[cell({ kind: 'blocked', lesson: null, blockedNote: 'Trip', blockedSlotId: 'b1' })],
				'2026-08-31'
			)
		).toEqual([{ blockedSlotId: 'b1', period: 1, classLabel: '9A/Ph1' }]);
	});

	test('a cell without a Blocked Slot yields nothing', () => {
		expect(blockedSlotLines([cell()], '2026-08-31')).toEqual([]);
	});

	test('cells on other dates are ignored', () => {
		expect(
			blockedSlotLines([cell({ date: '2026-09-01', blockedSlotId: 'b1' })], '2026-08-31')
		).toEqual([]);
	});

	test('the lines read in Period order across Classes', () => {
		const lines = blockedSlotLines(
			[
				cell({ kind: 'blocked', lesson: null, periodFrom: 4, blockedSlotId: 'b2' }),
				cell({
					kind: 'blocked',
					lesson: null,
					classLabel: '9C/Sc1',
					periodFrom: 2,
					blockedSlotId: 'b1'
				})
			],
			'2026-08-31'
		);
		expect(lines.map((l) => l.period)).toEqual([2, 4]);
	});
});
