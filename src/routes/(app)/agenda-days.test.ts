import { describe, expect, test } from 'vitest';
import type { BellSchedule, BellTime } from '$lib/bell';
import {
	agendaStream,
	filterByTag,
	groupByDay,
	lessonCount,
	tagsIn,
	withEvents
} from './agenda-days';

describe('groupByDay', () => {
	test('groups a sorted stream into one day per date, in order (issue #87)', () => {
		const days = groupByDay([
			{ date: '2026-09-03', periodFrom: 5 },
			{ date: '2026-09-03', periodFrom: 6 },
			{ date: '2026-09-04', periodFrom: 1 }
		]);

		expect(days.map((d) => d.date)).toEqual(['2026-09-03', '2026-09-04']);
		expect(days[0].rows).toHaveLength(2);
		expect(days[1].rows).toHaveLength(1);
	});

	test('a sparse window keeps every day it has as its own card', () => {
		const days = groupByDay([
			{ date: '2026-09-03', periodFrom: 1 },
			{ date: '2026-09-09', periodFrom: 4 },
			{ date: '2026-09-15', periodFrom: 2 }
		]);

		expect(days.map((d) => d.date)).toEqual(['2026-09-03', '2026-09-09', '2026-09-15']);
	});

	test('an empty horizon groups to nothing', () => {
		expect(groupByDay([])).toEqual([]);
	});
});

const practical = { date: '2026-09-03', lesson: { tags: ['Practical'] } };
const both = { date: '2026-09-03', lesson: { tags: ['Practical', 'Assessment'] } };
const untagged = { date: '2026-09-04', lesson: { tags: [] } };
const openSlot = { date: '2026-09-04', lesson: null };
const rows = [practical, both, untagged, openSlot];

describe('filterByTag (issue #280)', () => {
	test('keeps only the Lessons with the Tag, and drops Open Slots', () => {
		expect(filterByTag(rows, 'Practical')).toEqual([practical, both]);
	});

	test('a Lesson with two Tags is kept under either filter', () => {
		expect(filterByTag(rows, 'Assessment')).toEqual([both]);
	});

	test('the match is exact', () => {
		expect(filterByTag(rows, 'practical')).toEqual([]);
	});

	test('no Tag keeps every row, Open Slots included', () => {
		expect(filterByTag(rows, null)).toEqual(rows);
	});
});

describe('tagsIn (issue #280; counts issue #340)', () => {
	test('lists each distinct Tag once, in alphabetical order, with the count of rows that carry it, and Open Slots add none', () => {
		expect(tagsIn(rows)).toEqual([
			{ name: 'Assessment', count: 1 },
			{ name: 'Practical', count: 2 }
		]);
	});

	test('the count is the rows that carry the Tag: a Lesson scheduled twice counts twice', () => {
		const again = { date: '2026-09-10', lesson: { tags: ['Practical'] } };
		expect(tagsIn([practical, again])).toEqual([{ name: 'Practical', count: 2 }]);
	});

	test('alphabetical order ignores case', () => {
		const tagged = (tags: string[]) => ({ date: '2026-09-03', lesson: { tags } });
		expect(tagsIn([tagged(['Practical']), tagged(['biology'])])).toEqual([
			{ name: 'biology', count: 1 },
			{ name: 'Practical', count: 1 }
		]);
	});

	test('an empty window has no Tags', () => {
		expect(tagsIn([])).toEqual([]);
	});
});

describe('agendaStream', () => {
	const day = (date: string) => ({ date, rows: [{ date }] });

	test('teaching days, Blocked Days and School Holidays run in date order', () => {
		const stream = agendaStream(
			[day('2026-10-22'), day('2026-11-02')],
			[{ date: '2026-11-03', note: 'INSET' }],
			[{ starts: '2026-10-24', ends: '2026-11-01' }]
		);

		expect(stream.map((item) => [item.kind, item.date])).toEqual([
			['day', '2026-10-22'],
			['holiday', '2026-10-24'],
			['day', '2026-11-02'],
			['blocked', '2026-11-03']
		]);
		expect(stream[1]).toMatchObject({ ends: '2026-11-01' });
		expect(stream[3]).toMatchObject({ note: 'INSET' });
	});

	test('a Blocked Day keeps everything it came with, so an Absence keeps its lines', () => {
		const stream = agendaStream(
			[],
			[{ date: '2026-11-03', note: 'Ill', absent: true, lines: ['P1 10C/Ph2'] }],
			[]
		);

		expect(stream[0]).toMatchObject({ kind: 'blocked', absent: true, lines: ['P1 10C/Ph2'] });
	});

	test('a holiday already under way leads the stream', () => {
		const stream = agendaStream(
			[day('2026-11-02')],
			[],
			[{ starts: '2026-10-24', ends: '2026-11-01' }]
		);

		expect(stream.map((item) => item.kind)).toEqual(['holiday', 'day']);
	});
});

const time = (starts: string, ends: string): BellTime => ({ starts, ends });

// Years 9–10 lunch after P3, Years 11–13 after P4; Break shared (ADR-0033).
const lower: BellSchedule = {
	id: 'lower',
	name: 'Lower',
	isDefault: true,
	times: {
		1: time('08:50', '09:50'),
		2: time('09:50', '10:50'),
		8: time('10:50', '11:10'),
		3: time('11:10', '12:10'),
		9: time('12:10', '12:40'),
		4: time('12:40', '13:40'),
		5: time('13:40', '14:40'),
		6: time('14:40', '15:40')
	}
};
const upper: BellSchedule = {
	id: 'upper',
	name: 'Upper',
	isDefault: false,
	times: { ...lower.times, 4: time('12:10', '13:10'), 9: time('13:10', '13:40') }
};

type AgendaRow = { date: string; periodFrom: number; classId: string };
type AgendaEvent = { date: string; position: number; scheduleId: string | null };

// A Class follows Lower unless a test says Upper.
const classSchedules = { lowerClass: 'lower', upperClass: 'upper' };
const row = (date: string, periodFrom: number, classId = 'lowerClass'): AgendaRow => ({
	date,
	periodFrom,
	classId
});
const event = (date: string, position: number, scheduleId: string | null = null): AgendaEvent => ({
	date,
	position,
	scheduleId
});
const merge = (rows: AgendaRow[], events: AgendaEvent[], schedules: BellSchedule[] = []) =>
	withEvents(groupByDay(rows), events, { schedules, classSchedules }).map((d) => [
		d.date,
		d.rows.map((l) =>
			l.kind === 'row'
				? `P${l.row.periodFrom}`
				: l.kind === 'event'
					? `E${l.event.position}`
					: l.row.label
		)
	]);

describe('withEvents (ADR-0029)', () => {
	test('an Event sits in its Period among the rows, Before school first and After school last', () => {
		expect(
			merge(
				[row('2026-11-02', 1), row('2026-11-02', 4), row('2026-11-02', 6)],
				[event('2026-11-02', 7), event('2026-11-02', 0), event('2026-11-02', 3)]
			)
		).toEqual([['2026-11-02', ['E0', 'P1', 'E3', 'P4', 'P6', 'E7']]]);
	});

	test('a day with only Events is still a day, and days stay in date order', () => {
		expect(merge([row('2026-11-04', 2)], [event('2026-11-03', 0), event('2026-11-05', 7)])).toEqual(
			[
				['2026-11-03', ['E0']],
				['2026-11-04', ['P2']],
				['2026-11-05', ['E7']]
			]
		);
	});

	test('with no Events the days are as grouped', () => {
		expect(merge([row('2026-11-02', 1)], [])).toEqual([['2026-11-02', ['P1']]]);
	});
});

describe('withEvents with Bell Schedules (ADR-0033)', () => {
	test('a day teaching both Bell Schedules shows Break and both Lunches, in day order', () => {
		expect(
			merge([row('2026-11-02', 1), row('2026-11-02', 4, 'upperClass')], [], [lower, upper])
		).toEqual([['2026-11-02', ['P1', 'Break', 'Lunch (Lower)', 'P4', 'Lunch (Upper)']]]);
	});

	test('a day shows only the Lunch of a Bell Schedule it teaches, and the shared Break', () => {
		expect(merge([row('2026-11-02', 1), row('2026-11-02', 4)], [], [lower, upper])).toEqual([
			['2026-11-02', ['P1', 'Break', 'Lunch (Lower)', 'P4']]
		]);
		expect(merge([row('2026-11-03', 1, 'upperClass')], [], [lower, upper])).toEqual([
			['2026-11-03', ['P1', 'Break', 'Lunch (Upper)']]
		]);
	});

	test('an Event at Lunch (Upper) holds that row, and the other Lunch still shows quietly', () => {
		expect(
			merge(
				[row('2026-11-02', 1), row('2026-11-02', 4), row('2026-11-02', 5, 'upperClass')],
				[event('2026-11-02', 9, 'upper')],
				[lower, upper]
			)
		).toEqual([['2026-11-02', ['P1', 'Break', 'Lunch (Lower)', 'P4', 'E9', 'P5']]]);
	});

	test('an Event at Break holds the one shared row, whichever Bell Schedule it names', () => {
		expect(
			merge([row('2026-11-02', 1)], [event('2026-11-02', 8, 'upper')], [lower, upper])
		).toEqual([['2026-11-02', ['P1', 'E8', 'Lunch (Lower)']]]);
	});

	test('a day that holds only Events grows no Break or Lunch rows', () => {
		expect(merge([], [event('2026-11-02', 9, 'lower')], [lower, upper])).toEqual([
			['2026-11-02', ['E9']]
		]);
	});
});

describe('lessonCount', () => {
	const row = (date: string, lesson: { tags: string[] } | null, blocked = false) => ({
		date,
		lesson,
		blocked: blocked ? { note: null } : null
	});

	test('counts the Lessons a day holds, not its Open Slots or Blocked Slots', () => {
		const rows = [
			row('2026-11-06', { tags: [] }),
			row('2026-11-06', { tags: [] }),
			row('2026-11-06', null),
			row('2026-11-06', null, true),
			row('2026-11-09', { tags: [] })
		];
		expect(lessonCount(rows, '2026-11-06')).toBe(2);
		expect(lessonCount(rows, '2026-11-10')).toBe(0);
	});
});
