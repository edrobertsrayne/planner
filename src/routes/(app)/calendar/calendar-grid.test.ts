import { describe, expect, test } from 'vitest';
import { dayRows, type BellTime, type BellSchedule } from '$lib/bell';
import type { CalendarCell } from '$lib/server/planner';
import {
	availableSlotLines,
	absentSlotLines,
	blockedSlotLines,
	eventSpans,
	toEventGrid,
	toGrid
} from './calendar-grid';

type CellFields = {
	date: string;
	past: boolean;
	periodFrom: number;
	periodTo: number;
	classId: string;
	classLabel: string;
	tone: number;
	room: string | null;
	slotIds: string[];
};

const FIELDS: CellFields = {
	date: '2026-08-31',
	past: false,
	periodFrom: 1,
	periodTo: 1,
	classId: 'c1',
	classLabel: '9A/Ph1',
	tone: 0,
	room: null,
	slotIds: ['s1']
};

function lessonCell(
	overrides: Partial<
		CellFields & { lesson: { title: string; topicName: string | null }; placeable: boolean }
	> = {}
): CalendarCell {
	return {
		...FIELDS,
		kind: 'lesson',
		lesson: { title: 'Measuring speed', topicName: 'Forces' },
		placeable: true,
		...overrides
	};
}

function openCell(overrides: Partial<CellFields & { placeable: boolean }> = {}): CalendarCell {
	return { ...FIELDS, kind: 'open', placeable: true, ...overrides };
}

function blockedCell(
	overrides: Partial<
		CellFields & {
			blockedNote: string | null;
			blockedDayId: string | null;
			blockedSlotId: string | null;
			absent: boolean;
			cover: { id: string; lessonId: string; title: string } | null;
		}
	> = {}
): CalendarCell {
	return {
		...FIELDS,
		kind: 'blocked',
		blockedNote: null,
		blockedDayId: null,
		blockedSlotId: null,
		absent: false,
		cover: null,
		...overrides
	};
}

const DAYS = [
	{ date: '2026-08-31', kind: 'teaching' as const },
	{ date: '2026-09-01', kind: 'teaching' as const },
	{ date: '2026-09-02', kind: 'teaching' as const }
];

// The day before the first Bell Schedule, and the split day of ADR-0033: Years 9–10 lunch after P3,
// Years 11–13 after P4, Break shared.
const NO_BELL = dayRows([]);

const at = (starts: string, ends: string): BellTime => ({ starts, ends });
const LOWER: BellSchedule = {
	id: 'lower',
	name: 'Lower',
	isDefault: true,
	times: {
		1: at('08:50', '09:50'),
		2: at('09:50', '10:50'),
		8: at('10:50', '11:10'),
		3: at('11:10', '12:10'),
		9: at('12:10', '12:40'),
		4: at('12:40', '13:40'),
		5: at('13:40', '14:40'),
		6: at('14:40', '15:40')
	}
};
const UPPER: BellSchedule = {
	id: 'upper',
	name: 'Upper',
	isDefault: false,
	times: { ...LOWER.times, 4: at('12:10', '13:10'), 9: at('13:10', '13:40') }
};
const SPLIT = dayRows([LOWER, UPPER]);
const rowOf = (rows: typeof SPLIT, label: string) => rows.findIndex((r) => r.label === label);

describe('toGrid', () => {
	test('Periods down, days across — every date holds a column per row (issue #90)', () => {
		const grid = toGrid(DAYS, [], NO_BELL);
		expect(grid).toHaveLength(DAYS.length);
		expect(grid.every((column) => column.length === NO_BELL.length)).toBe(true);
	});

	test('an empty week is free everywhere a Class may sit, and a band elsewhere', () => {
		const grid = toGrid(DAYS, [], NO_BELL);
		expect(grid[0].map((e) => e.type)).toEqual([
			'band',
			'free',
			'free',
			'free',
			'free',
			'free',
			'free',
			'band'
		]);
	});

	test('a multi-Period Lesson starts once and covers the Periods after it', () => {
		const grid = toGrid(DAYS, [lessonCell({ periodFrom: 3, periodTo: 5 })], NO_BELL);
		expect(grid[0][3]).toMatchObject({ type: 'start', span: 3 });
		expect(grid[0][4]).toEqual({ type: 'covered' });
		expect(grid[0][5]).toEqual({ type: 'covered' });
		expect(grid[0][6]).toEqual({ type: 'free' });
	});

	test('a Blocked cell occupies its own Slot position only', () => {
		const grid = toGrid(
			DAYS,
			[blockedCell({ blockedNote: 'Trip', periodFrom: 4, periodTo: 4 })],
			NO_BELL
		);
		expect(grid[0][4]).toMatchObject({ type: 'start', span: 1 });
		// A Period that is nobody's Slot stays unmarked — never hatched by proximity.
		expect(grid[0][3]).toEqual({ type: 'free' });
		expect(grid[0][5]).toEqual({ type: 'free' });
	});

	test('cells on dates outside the week are ignored', () => {
		const grid = toGrid(DAYS, [lessonCell({ date: '2026-09-07' })], NO_BELL);
		expect(grid.flat().every((e) => e.type !== 'start')).toBe(true);
	});

	test('the start entry carries its cell through to the renderer', () => {
		const c = lessonCell({ classLabel: '7X/Sc1', tone: 4 });
		const start = toGrid(DAYS, [c], NO_BELL)[0][1];
		expect(start).toMatchObject({ type: 'start', cell: c });
	});

	test('the rows are the Bell Schedules’ own, and Break and Lunch are bands', () => {
		const types = toGrid(DAYS, [], SPLIT)[0].map((e) => e.type);
		expect(types).toHaveLength(SPLIT.length);
		for (const label of ['Break', 'Lunch (Lower)', 'Lunch (Upper)']) {
			expect(types[rowOf(SPLIT, label)]).toBe('band');
		}
	});

	// A duty sits at Lunch between a double's two Periods, so the rowspan stops at the band and the
	// rest of the Lesson starts again below it (ADR-0033).
	test('a double across a Lunch draws one tile either side, and the Lunch keeps its row', () => {
		const c = lessonCell({ periodFrom: 3, periodTo: 4 });
		const grid = toGrid(DAYS, [c], SPLIT)[0];
		const p3 = rowOf(SPLIT, 'P3');
		const lunch = rowOf(SPLIT, 'Lunch (Lower)');
		const p4 = rowOf(SPLIT, 'P4');

		expect(grid[p3]).toMatchObject({ type: 'start', cell: c, span: 1 });
		expect(grid[lunch]).toEqual({ type: 'band' });
		expect(grid[p4]).toMatchObject({ type: 'start', cell: c, span: 1 });
	});

	test('a double over a Break and a Lunch keeps both bands', () => {
		const c = lessonCell({ periodFrom: 2, periodTo: 4 });
		const grid = toGrid(DAYS, [c], SPLIT)[0];
		const start = rowOf(SPLIT, 'P2');
		expect(grid[start]).toMatchObject({ type: 'start', span: 1 });
		expect(grid[rowOf(SPLIT, 'Break')]).toEqual({ type: 'band' });
		expect(grid[rowOf(SPLIT, 'P3')]).toMatchObject({ type: 'start', span: 1 });
		expect(grid[rowOf(SPLIT, 'Lunch (Lower)')]).toEqual({ type: 'band' });
		expect(grid[rowOf(SPLIT, 'P4')]).toMatchObject({ type: 'start', span: 1 });
		// The Periods before and after the cell are untouched.
		expect(grid[rowOf(SPLIT, 'P1')]).toEqual({ type: 'free' });
		expect(grid[rowOf(SPLIT, 'P5')]).toEqual({ type: 'free' });
	});
});

describe('availableSlotLines', () => {
	test('a Lesson of one Period offers its one Slot', () => {
		expect(availableSlotLines([lessonCell({ slotIds: ['s1'] })], '2026-08-31')).toEqual([
			{ slotId: 's1', period: 1, classId: 'c1', classLabel: '9A/Ph1', placeable: true }
		]);
	});

	test('a Lesson over two Periods offers both Slots, one per Period, in Period order', () => {
		const slots = availableSlotLines(
			[lessonCell({ periodFrom: 3, periodTo: 4, slotIds: ['s3', 's4'] })],
			'2026-08-31'
		);
		expect(slots).toEqual([
			{ slotId: 's3', period: 3, classId: 'c1', classLabel: '9A/Ph1', placeable: true },
			{ slotId: 's4', period: 4, classId: 'c1', classLabel: '9A/Ph1', placeable: true }
		]);
	});

	test('an Open Slot is offered — the Period is taught even when no Lesson is scheduled', () => {
		expect(availableSlotLines([openCell()], '2026-08-31')).toEqual([
			{ slotId: 's1', period: 1, classId: 'c1', classLabel: '9A/Ph1', placeable: true }
		]);
	});

	// The cell's own answer, not a guess from the Lesson's Topic: an occasion that already holds a
	// placed Lesson, or a past date, is not offered.
	test('a cell that cannot take a Placement is marked so', () => {
		expect(
			availableSlotLines(
				[lessonCell({ placeable: false, lesson: { title: 'Assembly', topicName: null } })],
				'2026-08-31'
			)
		).toEqual([{ slotId: 's1', period: 1, classId: 'c1', classLabel: '9A/Ph1', placeable: false }]);
	});

	test('a past Open Slot offers nothing to place', () => {
		expect(availableSlotLines([openCell({ past: true, placeable: false })], '2026-08-31')).toEqual([
			{ slotId: 's1', period: 1, classId: 'c1', classLabel: '9A/Ph1', placeable: false }
		]);
	});

	test('a Blocked cell offers nothing — its Slot is already gone', () => {
		expect(availableSlotLines([blockedCell({ blockedNote: 'Trip' })], '2026-08-31')).toEqual([]);
	});

	test('a day that is already off — every cell Blocked — offers nothing to block', () => {
		expect(
			availableSlotLines(
				[
					blockedCell({ blockedNote: 'Snow' }),
					blockedCell({
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
		expect(availableSlotLines([lessonCell({ date: '2026-09-01' })], '2026-08-31')).toEqual([]);
	});

	test('the lines read in Period order across Classes', () => {
		const slots = availableSlotLines(
			[
				lessonCell({ periodFrom: 4, slotIds: ['s4'] }),
				lessonCell({ classLabel: '9C/Sc1', periodFrom: 2, slotIds: ['t2'] })
			],
			'2026-08-31'
		);
		expect(slots.map((s) => s.period)).toEqual([2, 4]);
	});
});

describe('blockedSlotLines', () => {
	test('a Blocked Slot cell yields the line its Unblock needs', () => {
		expect(
			blockedSlotLines([blockedCell({ blockedNote: 'Trip', blockedSlotId: 'b1' })], '2026-08-31')
		).toEqual([{ blockedSlotId: 'b1', period: 1, classLabel: '9A/Ph1' }]);
	});

	test('a cell without a Blocked Slot yields nothing', () => {
		expect(blockedSlotLines([lessonCell()], '2026-08-31')).toEqual([]);
	});

	test('cells on other dates are ignored', () => {
		expect(
			blockedSlotLines([blockedCell({ date: '2026-09-01', blockedSlotId: 'b1' })], '2026-08-31')
		).toEqual([]);
	});

	test('the lines read in Period order across Classes', () => {
		const lines = blockedSlotLines(
			[
				blockedCell({ periodFrom: 4, blockedSlotId: 'b2' }),
				blockedCell({
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

describe('absentSlotLines', () => {
	test('an absent blocked cell yields the line Set cover needs, with its Cover', () => {
		const cover = { id: 'v1', lessonId: 'l1', title: 'Silent reading' };

		expect(
			absentSlotLines([blockedCell({ absent: true, slotIds: ['s1'], cover })], '2026-08-31')
		).toEqual([
			{
				slotId: 's1',
				period: 1,
				classId: 'c1',
				classLabel: '9A/Ph1',
				tone: 0,
				room: null,
				cover
			}
		]);
	});

	test('a closure, a lesson and another date yield nothing', () => {
		expect(
			absentSlotLines(
				[blockedCell(), lessonCell(), blockedCell({ absent: true, date: '2026-09-01' })],
				'2026-08-31'
			)
		).toEqual([]);
	});

	test('the lines read in Period order across Classes', () => {
		const lines = absentSlotLines(
			[
				blockedCell({ absent: true, periodFrom: 4, slotIds: ['s4'] }),
				blockedCell({ absent: true, periodFrom: 2, slotIds: ['s2'], classLabel: '9C/Sc1' })
			],
			'2026-08-31'
		);

		expect(lines.map((l) => l.period)).toEqual([2, 4]);
	});
});

describe('toEventGrid (ADR-0029)', () => {
	const ev = (date: string, position: number, scheduleId: string | null = null) => ({
		date,
		position,
		scheduleId,
		name: `E${position}`
	});
	const days = [{ date: '2026-11-02' }, { date: '2026-11-03' }];

	test('one slot per day for Before school, the six Periods and After school', () => {
		const grid = toEventGrid(
			days,
			[ev('2026-11-02', 0), ev('2026-11-02', 3), ev('2026-11-03', 7)],
			NO_BELL
		);

		expect(grid).toHaveLength(2);
		expect(grid[0]).toHaveLength(8);
		expect(grid[0][0]?.name).toBe('E0');
		expect(grid[0][3]?.name).toBe('E3');
		expect(grid[1][7]?.name).toBe('E7');
		expect(grid[0][1]).toBeNull();
	});

	test('an Event on a date outside the week is ignored', () => {
		const grid = toEventGrid(days, [ev('2026-12-01', 2)], NO_BELL);
		expect(grid.flat().every((e) => e === null)).toBe(true);
	});

	// Break is one row for the whole school; each Lunch is its own, so the Bell Schedule an Event
	// names chooses the row (ADR-0033).
	test('a Duty at Break or Lunch lands in the row its Bell Schedule times', () => {
		const column = (position: number, scheduleId: string | null) =>
			toEventGrid(days, [ev('2026-11-02', position, scheduleId)], SPLIT)[0];
		const lowerLunch = rowOf(SPLIT, 'Lunch (Lower)');
		const upperLunch = rowOf(SPLIT, 'Lunch (Upper)');

		expect(column(8, 'upper')[rowOf(SPLIT, 'Break')]?.name).toBe('E8');
		expect(column(9, 'lower')[lowerLunch]?.name).toBe('E9');
		expect(column(9, 'upper')[upperLunch]?.name).toBe('E9');
		// An Upper Lunch never shows in Lower's row, and the other way round.
		expect(column(9, 'upper')[lowerLunch]).toBeNull();
		expect(column(9, 'lower')[upperLunch]).toBeNull();
	});
});

describe('eventSpans', () => {
	const e = (eventId: string, position: number) => ({ eventId, position });

	test('adjacent Periods of one Event are one block starting at the first', () => {
		const column = [null, null, e('a', 1), e('a', 2), null, null, null, null];
		expect(eventSpans(column)).toEqual([1, 1, 2, 0, 1, 1, 1, 1]);
	});

	test('three adjacent Periods span three', () => {
		const column = [null, e('a', 1), e('a', 2), e('a', 3), null, null, null, null];
		expect(eventSpans(column).slice(1, 4)).toEqual([3, 0, 0]);
	});

	test('different Events in adjacent Periods stay separate', () => {
		const column = [null, e('a', 1), e('b', 2), null, null, null, null, null];
		expect(eventSpans(column).slice(1, 3)).toEqual([1, 1]);
	});

	test('Before school and After school never merge with a Period', () => {
		const column = [e('a', 0), e('a', 1), null, null, null, null, e('a', 6), e('a', 7)];
		expect(eventSpans(column)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
	});

	// A Break or Lunch row between a double's Periods is a row of its own, so the Event's block
	// stops above it and starts again below: a Duty there must keep its row (ADR-0033).
	test('a Break or Lunch row between two Periods splits the Event’s block', () => {
		const column = [null, e('a', 3), null, e('a', 4)];
		expect(eventSpans(column)).toEqual([1, 1, 1, 1]);
	});

	test('a Break or Lunch Event never merges with a Period', () => {
		const column = [null, e('a', 6), e('a', 8), e('a', 9)];
		expect(eventSpans(column)).toEqual([1, 1, 1, 1]);
	});
});
