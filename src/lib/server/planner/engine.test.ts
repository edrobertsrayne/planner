import { describe, expect, test } from 'vitest';
import { agendaRows, type ScheduleResult } from './engine';

function resultOf(partial: Partial<ScheduleResult>): ScheduleResult {
	return {
		boundary: '2026-09-03',
		history: [],
		planned: [],
		unplaced: [],
		unplanned: [],
		...partial
	};
}

describe('agendaRows', () => {
	test('a Lesson with Planned Length 1 is one row', () => {
		const result = resultOf({
			planned: [
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
				slotId: 's1',
				lesson: { lessonId: 'l1', part: 1, of: 1 }
			}
		]);
	});

	test('a Lesson with Planned Length > 1 in consecutive Periods on the same date is one row spanning them', () => {
		// 9B/Sc1's Thursday double, P5 and P6 on the same date.
		const result = resultOf({
			planned: [
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
				slotId: 's1',
				lesson: { lessonId: 'l1', part: 2, of: 2 }
			}
		]);
	});

	test('a Lesson split across two dates is never merged into one row', () => {
		const result = resultOf({
			planned: [
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
			planned: [
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

	test('an Unplanned Slot is a row carrying no Lesson', () => {
		const result = resultOf({
			unplanned: [{ date: '2026-09-03', period: 5, slotId: 's1', week: 'A' }]
		});

		expect(agendaRows('c1', result)).toEqual([
			{
				classId: 'c1',
				date: '2026-09-03',
				week: 'A',
				periodFrom: 5,
				periodTo: 5,
				slotId: 's1',
				lesson: null
			}
		]);
	});

	test('planned rows precede unplanned rows, both tagged with the given Class', () => {
		const result = resultOf({
			planned: [
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
			unplanned: [{ date: '2026-09-08', period: 1, slotId: 's2', week: 'B' }]
		});

		const rows = agendaRows('c1', result);
		expect(rows.map((r) => r.classId)).toEqual(['c1', 'c1']);
		expect(rows[0].lesson).not.toBeNull();
		expect(rows[1].lesson).toBeNull();
	});
});
