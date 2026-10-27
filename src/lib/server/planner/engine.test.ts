import { describe, expect, test } from 'vitest';
import {
	runsOf,
	schedule,
	schoolHolidays,
	termWindowEnd,
	timetabledSlots,
	type Calendar,
	type Placement,
	type RunPart,
	type ScheduleResult,
	type TimetabledSlot
} from './engine';

// One Class, one Teaching Week (Mon 7 Sep – Fri 11 Sep 2026), three Periods every day — enough
// room to collide, block and shift-right without a second week's bookkeeping.
const DAYS = {
	1: '2026-09-07',
	2: '2026-09-08',
	3: '2026-09-09',
	4: '2026-09-10',
	5: '2026-09-11'
};

function calendarOf(overrides: Partial<Calendar> = {}): Calendar {
	return {
		terms: [{ opens: '2026-09-01', closes: '2026-09-30' }],
		teachingWeeks: [{ weekCommencing: '2026-09-07', letter: 'A' }],
		slots: ([1, 2, 3, 4, 5] as const).flatMap((day) =>
			[1, 2, 3].map((period) => ({
				id: `d${day}p${period}`,
				classId: 'c1',
				week: 'A' as const,
				day,
				period,
				holdsFrom: null,
				holdsTo: null
			}))
		),
		blockedDays: [],
		blockedSlots: [],
		...overrides
	};
}

function scheduleOf(cal: Calendar, placements: Placement[]): ScheduleResult {
	return schedule({
		cal,
		lessons: [],
		classId: 'c1',
		sessions: [],
		continuations: [],
		placements,
		boundary: '2026-09-01'
	});
}

describe('runsOf', () => {
	const part = (overrides: Partial<RunPart> = {}): RunPart => ({
		classId: 'c1',
		date: '2026-09-03',
		period: 5,
		lessonId: 'l1',
		slotId: 's1',
		...overrides
	});

	test('a Lesson of one Period is one run', () => {
		expect(runsOf([part()])).toEqual([
			{
				classId: 'c1',
				date: '2026-09-03',
				periodFrom: 5,
				periodTo: 5,
				lessonId: 'l1',
				slotIds: ['s1']
			}
		]);
	});

	test('consecutive Periods of one Lesson on one date are one run spanning them', () => {
		expect(runsOf([part(), part({ period: 6, slotId: 's2' })])).toEqual([
			{
				classId: 'c1',
				date: '2026-09-03',
				periodFrom: 5,
				periodTo: 6,
				lessonId: 'l1',
				slotIds: ['s1', 's2']
			}
		]);
	});

	test('a Lesson split across two dates is never merged into one run', () => {
		const runs = runsOf([part({ period: 6 }), part({ date: '2026-09-08', period: 1 })]);

		expect(runs).toHaveLength(2);
		expect(runs[0]).toMatchObject({ date: '2026-09-03', periodFrom: 6, periodTo: 6 });
		expect(runs[1]).toMatchObject({ date: '2026-09-08', periodFrom: 1, periodTo: 1 });
	});

	test('two different Lessons in adjacent Periods on the same date are never merged', () => {
		expect(runsOf([part(), part({ period: 6, lessonId: 'l2' })])).toHaveLength(2);
	});

	test('two Classes in adjacent Periods are never merged', () => {
		expect(runsOf([part(), part({ period: 6, classId: 'c2' })])).toHaveLength(2);
	});

	test('a run records no Slot when one of its Periods has none', () => {
		const [run] = runsOf([part({ slotId: null }), part({ period: 6, slotId: 's2' })]);

		expect(run.slotIds).toEqual([]);
	});
});

describe('timetabledSlots', () => {
	const at = (cal: Calendar, date: string, period: number): TimetabledSlot =>
		timetabledSlots(cal, 'c1').find((slot) => slot.date === date && slot.period === period)!;

	test('walks the Teaching Week in calendar order, and an occasion nothing removes is Available', () => {
		const slots = timetabledSlots(calendarOf(), 'c1');

		expect(slots).toHaveLength(15);
		expect(slots[0]).toEqual({
			date: DAYS[1],
			period: 1,
			slotId: 'd1p1',
			week: 'A',
			classId: 'c1',
			removedBy: []
		});
		expect(slots.map((slot) => `${slot.date}|${slot.period}`)).toEqual(
			[1, 2, 3, 4, 5].flatMap((day) => [1, 2, 3].map((period) => `${DAYS[day as 1]}|${period}`))
		);
	});

	test('names what removes an occasion: a Blocked Day, or a Blocked Slot, or neither', () => {
		const cal = calendarOf({
			blockedDays: [{ id: 'b1', date: DAYS[2], note: 'INSET' }],
			blockedSlots: [{ id: 'bs1', classId: 'c1', date: DAYS[3], slotId: 'd3p2', note: 'Trip' }]
		});

		expect(at(cal, DAYS[2], 1).removedBy).toEqual([{ kind: 'day', id: 'b1', note: 'INSET' }]);
		expect(at(cal, DAYS[3], 2).removedBy).toEqual([{ kind: 'slot', id: 'bs1', note: 'Trip' }]);
		expect(at(cal, DAYS[3], 1).removedBy).toEqual([]);
	});

	test('keeps every reason, so a Blocked Slot survives a Blocked Day and a date outside every Term', () => {
		const cal = calendarOf({
			terms: [{ opens: DAYS[3], closes: '2026-09-30' }],
			blockedDays: [{ id: 'b1', date: DAYS[1], note: null }],
			blockedSlots: [{ id: 'bs1', classId: 'c1', date: DAYS[1], slotId: 'd1p2', note: 'Trip' }]
		});

		expect(at(cal, DAYS[1], 1).removedBy).toEqual([
			{ kind: 'outside-term' },
			{ kind: 'day', id: 'b1', note: null }
		]);
		expect(at(cal, DAYS[1], 2).removedBy).toEqual([
			{ kind: 'outside-term' },
			{ kind: 'day', id: 'b1', note: null },
			{ kind: 'slot', id: 'bs1', note: 'Trip' }
		]);
	});

	test('a `from` date drops every occasion before it, and a Class narrows the walk to its own Slots', () => {
		const cal = calendarOf({
			slots: calendarOf().slots.concat(
				[...Array(3)].map((_, i) => ({
					id: `other${i}`,
					classId: 'c2',
					week: 'A' as const,
					day: 1,
					period: i + 1,
					holdsFrom: null,
					holdsTo: null
				}))
			)
		});

		const from = timetabledSlots(cal, 'c1', DAYS[3]);
		expect(from[0].date).toBe(DAYS[3]);
		expect(from.every((slot) => slot.date >= DAYS[3])).toBe(true);

		expect(timetabledSlots(cal, 'c2').map((slot) => slot.slotId)).toEqual([
			'other0',
			'other1',
			'other2'
		]);
	});
});

describe('schedule with Placements', () => {
	test('history resolves each recorded Session to its Slot and, when a Placement names the Lesson, its Placement', () => {
		const result = schedule({
			cal: calendarOf(),
			lessons: [],
			classId: 'c1',
			sessions: [
				{ classId: 'c1', date: DAYS[1], period: 1, lessonId: 'seq' },
				{ classId: 'c1', date: DAYS[1], period: 3, lessonId: 'pl' },
				{ classId: 'c1', date: DAYS[1], period: 4, lessonId: 'gone' }
			],
			continuations: [],
			placements: [
				{ id: 'p1', classId: 'c1', date: DAYS[1], slotId: 'd1p3', lessonId: 'pl', length: 1 }
			],
			boundary: DAYS[2]
		});

		expect(result.history).toMatchObject([
			{ date: DAYS[1], period: 1, lessonId: 'seq', slotId: 'd1p1', placementId: undefined },
			{ date: DAYS[1], period: 3, lessonId: 'pl', slotId: 'd1p3', placementId: 'p1' },
			// No Slot holds P4: the record keeps the occasion, with no Slot left to name.
			{ date: DAYS[1], period: 4, lessonId: 'gone', slotId: null }
		]);
	});

	test('a Length-1 and a Length-2 Placement lay onto the stream with no disruption', () => {
		const result = scheduleOf(calendarOf(), [
			{ id: 'p1', classId: 'c1', date: DAYS[1], slotId: 'd1p1', lessonId: 'l1', length: 1 },
			{ id: 'p2', classId: 'c1', date: DAYS[3], slotId: 'd3p1', lessonId: 'l2', length: 2 }
		]);

		expect(result.scheduled).toContainEqual({
			classId: 'c1',
			date: DAYS[1],
			period: 1,
			slotId: 'd1p1',
			week: 'A',
			lessonId: 'l1',
			part: 1,
			of: 1,
			placementId: 'p1'
		});
		expect(result.scheduled).toContainEqual({
			classId: 'c1',
			date: DAYS[3],
			period: 1,
			slotId: 'd3p1',
			week: 'A',
			lessonId: 'l2',
			part: 1,
			of: 2,
			placementId: 'p2'
		});
		expect(result.scheduled).toContainEqual({
			classId: 'c1',
			date: DAYS[3],
			period: 2,
			slotId: 'd3p2',
			week: 'A',
			lessonId: 'l2',
			part: 2,
			of: 2,
			placementId: 'p2'
		});
	});

	test('a Placement whose anchor Slot is later Blocked shift-rights past it', () => {
		const cal = calendarOf({
			blockedSlots: [{ id: 'bs1', classId: 'c1', date: DAYS[1], slotId: 'd1p1', note: null }]
		});
		const result = scheduleOf(cal, [
			{ id: 'p1', classId: 'c1', date: DAYS[1], slotId: 'd1p1', lessonId: 'l1', length: 1 }
		]);

		const own = result.scheduled.filter((s) => s.placementId === 'p1');
		expect(own).toHaveLength(1);
		expect(own[0]).toMatchObject({ date: DAYS[1], period: 2 });
	});

	test("a Blocked Slot later in a Placement run only moves that Placement's own later parts", () => {
		const cal = calendarOf({
			blockedSlots: [{ id: 'bs1', classId: 'c1', date: DAYS[1], slotId: 'd1p2', note: null }]
		});
		const result = scheduleOf(cal, [
			{ id: 'p1', classId: 'c1', date: DAYS[1], slotId: 'd1p1', lessonId: 'l1', length: 2 }
		]);

		const own = result.scheduled
			.filter((s) => s.placementId === 'p1')
			.sort((a, b) => a.part - b.part);
		expect(own).toHaveLength(2);
		expect(own[0]).toMatchObject({ date: DAYS[1], period: 1, part: 1 });
		expect(own[1]).toMatchObject({ date: DAYS[1], period: 3, part: 2 });
	});

	test('two Placements whose anchors collide resolve by ascending-anchor order', () => {
		const result = scheduleOf(calendarOf(), [
			{ id: 'later', classId: 'c1', date: DAYS[1], slotId: 'd1p2', lessonId: 'l2', length: 1 },
			{ id: 'earlier', classId: 'c1', date: DAYS[1], slotId: 'd1p1', lessonId: 'l1', length: 2 }
		]);

		// "earlier" (anchor P1) is walked first and claims P1 and P2, so "later" (anchor P2) is
		// pushed past it to P3 — the later-anchored Placement shifts right, never the earlier one.
		const earlier = result.scheduled.filter((s) => s.placementId === 'earlier');
		const later = result.scheduled.filter((s) => s.placementId === 'later');
		expect(earlier.map((s) => s.period)).toEqual([1, 2]);
		expect(later.map((s) => s.period)).toEqual([3]);
	});

	test("a Placement's parts collapse into one run, mirroring a Continuation", () => {
		const result = scheduleOf(calendarOf(), [
			{ id: 'p1', classId: 'c1', date: DAYS[1], slotId: 'd1p1', lessonId: 'l1', length: 2 }
		]);

		expect(runsOf(result.scheduled).filter((run) => run.lessonId === 'l1')).toEqual([
			{
				classId: 'c1',
				date: DAYS[1],
				periodFrom: 1,
				periodTo: 2,
				lessonId: 'l1',
				slotIds: ['d1p1', 'd1p2']
			}
		]);
	});

	test('a Length-2 Placement anchored at the last Period of a day runs into the next day', () => {
		const result = scheduleOf(calendarOf(), [
			{ id: 'p1', classId: 'c1', date: DAYS[1], slotId: 'd1p3', lessonId: 'l1', length: 2 }
		]);

		const own = result.scheduled
			.filter((s) => s.placementId === 'p1')
			.sort((a, b) => a.part - b.part);
		expect(own).toHaveLength(2);
		expect(own[0]).toMatchObject({ date: DAYS[1], period: 3, part: 1 });
		expect(own[1]).toMatchObject({ date: DAYS[2], period: 1, part: 2 });
	});

	test('a Placement with no Available Slot left at or after its anchor is reported stranded, not silently dropped', () => {
		const cal = calendarOf({ blockedDays: [{ id: 'b1', date: DAYS[5], note: null }] });
		const result = scheduleOf(cal, [
			{ id: 'p1', classId: 'c1', date: DAYS[5], slotId: 'd5p3', lessonId: 'l1', length: 1 }
		]);

		expect(result.scheduled.filter((s) => s.placementId === 'p1')).toEqual([]);
		expect(result.strandedPlacementIds).toEqual(['p1']);
	});

	test('a Length-3 Placement with only one Available Slot left at its anchor reports the unclaimed tail as unplaced, not stranded', () => {
		const cal = calendarOf({
			blockedDays: [
				{ id: 'b1', date: DAYS[1], note: null },
				{ id: 'b2', date: DAYS[2], note: null },
				{ id: 'b3', date: DAYS[3], note: null },
				{ id: 'b4', date: DAYS[4], note: null }
			]
		});
		const result = scheduleOf(cal, [
			{ id: 'p1', classId: 'c1', date: DAYS[5], slotId: 'd5p3', lessonId: 'l1', length: 3 }
		]);

		expect(result.scheduled.filter((s) => s.placementId === 'p1')).toMatchObject([
			{ date: DAYS[5], period: 3, lessonId: 'l1', part: 1, of: 3 }
		]);
		expect(result.strandedPlacementIds).toEqual([]);
		expect(result.unplaced).toEqual([
			{ lessonId: 'l1', part: 2, of: 3 },
			{ lessonId: 'l1', part: 3, of: 3 }
		]);
	});

	test('a Continuation on a placed Session widens the Placement and shift-rights the Sequence by one Slot', () => {
		const result = schedule({
			cal: calendarOf(),
			lessons: [{ id: 'seq', length: 1 }],
			classId: 'c1',
			// The placed Lesson's own part was taught on DAYS[1] P1, and the teacher has marked
			// that Session as needing more time (ADR-0022).
			sessions: [{ classId: 'c1', date: DAYS[1], period: 1, lessonId: 'pl' }],
			continuations: [{ classId: 'c1', lessonId: 'pl' }],
			placements: [
				{ id: 'p1', classId: 'c1', date: DAYS[2], slotId: 'd2p1', lessonId: 'pl', length: 1 }
			],
			boundary: DAYS[2]
		});

		// Length 1 plus one Continuation is two parts: part 1 is history, so one more part lands
		// on the Placement's own anchor and reports the widened total.
		expect(result.scheduled.filter((s) => s.placementId === 'p1')).toEqual([
			expect.objectContaining({
				date: DAYS[2],
				period: 1,
				lessonId: 'pl',
				part: 2,
				of: 2
			})
		]);
		// The Sequence's own Lesson would have taken DAYS[2] P1; the extra part pushes it one Slot
		// right, to P2.
		expect(result.scheduled.find((s) => s.lessonId === 'seq')).toMatchObject({
			date: DAYS[2],
			period: 2,
			part: 1,
			of: 1
		});
	});
});

// Autumn 1 closes Fri 23 Oct; half-term runs Sat 24 Oct – Sun 1 Nov; Autumn 2 opens Mon 2 Nov.
const AUTUMN = [
	{ opens: '2026-09-03', closes: '2026-10-23' },
	{ opens: '2026-11-02', closes: '2026-12-18' }
];

describe('termWindowEnd', () => {
	test('inside a Term the window is calendar days, today counting as the first', () => {
		expect(termWindowEnd(AUTUMN, '2026-09-03', 1)).toBe('2026-09-03');
		expect(termWindowEnd(AUTUMN, '2026-09-03', 7)).toBe('2026-09-09');
	});

	test('a School Holiday inside the window is skipped, not counted', () => {
		// Thu 22 and Fri 23 Oct are two Term days; the other five fall after half-term.
		expect(termWindowEnd(AUTUMN, '2026-10-22', 7)).toBe('2026-11-06');
	});

	test('a window starting in a School Holiday opens on the next Term', () => {
		expect(termWindowEnd(AUTUMN, '2026-10-27', 7)).toBe('2026-11-08');
	});

	test('a null window, or one longer than the Terms, reaches the close of the last Term', () => {
		expect(termWindowEnd(AUTUMN, '2026-10-27', null)).toBe('2026-12-18');
		expect(termWindowEnd(AUTUMN, '2026-12-14', 28)).toBe('2026-12-18');
	});

	test('with no Term day ahead the window ends today', () => {
		expect(termWindowEnd(AUTUMN, '2026-12-25', 7)).toBe('2026-12-25');
		expect(termWindowEnd([], '2026-10-27', 7)).toBe('2026-10-27');
	});
});

describe('schoolHolidays', () => {
	test('a holiday between two Terms runs from the day after one closes to the day before the next opens', () => {
		expect(schoolHolidays(AUTUMN, '2026-10-22', '2026-11-06')).toEqual([
			{ starts: '2026-10-24', ends: '2026-11-01' }
		]);
	});

	test('a holiday already under way keeps its first day', () => {
		expect(schoolHolidays(AUTUMN, '2026-10-27', '2026-11-08')).toEqual([
			{ starts: '2026-10-24', ends: '2026-11-01' }
		]);
	});

	test('a window inside one Term touches no holiday', () => {
		expect(schoolHolidays(AUTUMN, '2026-09-03', '2026-10-23')).toEqual([]);
	});

	test('before the first Term the holiday starts today', () => {
		expect(schoolHolidays(AUTUMN, '2026-08-20', '2026-09-09')).toEqual([
			{ starts: '2026-08-20', ends: '2026-09-02' }
		]);
	});
});
