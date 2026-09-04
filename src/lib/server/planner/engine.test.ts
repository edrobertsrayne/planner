import { describe, expect, test } from 'vitest';
import { agendaRows, schedule, type Calendar, type Placement, type ScheduleResult } from './engine';

function resultOf(partial: Partial<ScheduleResult>): ScheduleResult {
	return {
		boundary: '2026-09-03',
		history: [],
		scheduled: [],
		unplaced: [],
		openSlots: [],
		...partial
	};
}

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

describe('agendaRows', () => {
	test('a Lesson with Length 1 is one row', () => {
		const result = resultOf({
			scheduled: [
				{
					classId: 'c1',
					date: '2026-09-03',
					period: 5,
					slotId: 's1',
					week: 'A',
					lessonId: 'l1',
					part: 1,
					of: 1
				}
			]
		});

		expect(agendaRows('c1', result)).toEqual([
			{
				classId: 'c1',
				date: '2026-09-03',
				week: 'A',
				periodFrom: 5,
				periodTo: 5,
				slotIds: ['s1'],
				lesson: { lessonId: 'l1', part: 1, of: 1 }
			}
		]);
	});

	test('a Lesson with Length > 1 in consecutive Periods on the same date is one row spanning them', () => {
		// 9B/Sc1's Thursday double, P5 and P6 on the same date.
		const result = resultOf({
			scheduled: [
				{
					classId: 'c1',
					date: '2026-09-03',
					period: 5,
					slotId: 's1',
					week: 'A',
					lessonId: 'l1',
					part: 1,
					of: 2
				},
				{
					classId: 'c1',
					date: '2026-09-03',
					period: 6,
					slotId: 's2',
					week: 'A',
					lessonId: 'l1',
					part: 2,
					of: 2
				}
			]
		});

		expect(agendaRows('c1', result)).toEqual([
			{
				classId: 'c1',
				date: '2026-09-03',
				week: 'A',
				periodFrom: 5,
				periodTo: 6,
				slotIds: ['s1', 's2'],
				lesson: { lessonId: 'l1', part: 2, of: 2 }
			}
		]);
	});

	test('a Lesson split across two dates is never merged into one row', () => {
		const result = resultOf({
			scheduled: [
				{
					classId: 'c1',
					date: '2026-09-03',
					period: 6,
					slotId: 's1',
					week: 'A',
					lessonId: 'l1',
					part: 1,
					of: 2
				},
				{
					classId: 'c1',
					date: '2026-09-08',
					period: 1,
					slotId: 's2',
					week: 'B',
					lessonId: 'l1',
					part: 2,
					of: 2
				}
			]
		});

		const rows = agendaRows('c1', result);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({ date: '2026-09-03', periodFrom: 6, periodTo: 6 });
		expect(rows[1]).toMatchObject({ date: '2026-09-08', periodFrom: 1, periodTo: 1 });
	});

	test('two different Lessons in adjacent Periods on the same date are never merged', () => {
		const result = resultOf({
			scheduled: [
				{
					classId: 'c1',
					date: '2026-09-03',
					period: 5,
					slotId: 's1',
					week: 'A',
					lessonId: 'l1',
					part: 1,
					of: 1
				},
				{
					classId: 'c1',
					date: '2026-09-03',
					period: 6,
					slotId: 's2',
					week: 'A',
					lessonId: 'l2',
					part: 1,
					of: 1
				}
			]
		});

		expect(agendaRows('c1', result)).toHaveLength(2);
	});

	test('an Open Slot is a row carrying no Lesson', () => {
		const result = resultOf({
			openSlots: [{ date: '2026-09-03', period: 5, slotId: 's1', week: 'A' }]
		});

		expect(agendaRows('c1', result)).toEqual([
			{
				classId: 'c1',
				date: '2026-09-03',
				week: 'A',
				periodFrom: 5,
				periodTo: 5,
				slotIds: ['s1'],
				lesson: null
			}
		]);
	});

	test('scheduled rows precede open rows, both tagged with the given Class', () => {
		const result = resultOf({
			scheduled: [
				{
					classId: 'c1',
					date: '2026-09-03',
					period: 5,
					slotId: 's1',
					week: 'A',
					lessonId: 'l1',
					part: 1,
					of: 1
				}
			],
			openSlots: [{ date: '2026-09-08', period: 1, slotId: 's2', week: 'B' }]
		});

		const rows = agendaRows('c1', result);
		expect(rows.map((r) => r.classId)).toEqual(['c1', 'c1']);
		expect(rows[0].lesson).not.toBeNull();
		expect(rows[1].lesson).toBeNull();
	});
});

describe('schedule with Placements', () => {
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
		const cal = calendarOf({ blockedSlots: [{ classId: 'c1', date: DAYS[1], slotId: 'd1p1' }] });
		const result = scheduleOf(cal, [
			{ id: 'p1', classId: 'c1', date: DAYS[1], slotId: 'd1p1', lessonId: 'l1', length: 1 }
		]);

		const own = result.scheduled.filter((s) => s.placementId === 'p1');
		expect(own).toHaveLength(1);
		expect(own[0]).toMatchObject({ date: DAYS[1], period: 2 });
	});

	test("a Blocked Slot later in a Placement run only moves that Placement's own later parts", () => {
		const cal = calendarOf({ blockedSlots: [{ classId: 'c1', date: DAYS[1], slotId: 'd1p2' }] });
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

	test("a Placement's parts collapse into one agendaRows entry, mirroring a Continuation", () => {
		const result = scheduleOf(calendarOf(), [
			{ id: 'p1', classId: 'c1', date: DAYS[1], slotId: 'd1p1', lessonId: 'l1', length: 2 }
		]);

		const rows = agendaRows('c1', result).filter((r) => r.lesson?.lessonId === 'l1');
		expect(rows).toEqual([
			{
				classId: 'c1',
				date: DAYS[1],
				week: 'A',
				periodFrom: 1,
				periodTo: 2,
				slotIds: ['d1p1', 'd1p2'],
				lesson: { lessonId: 'l1', part: 2, of: 2 }
			}
		]);
	});
});
