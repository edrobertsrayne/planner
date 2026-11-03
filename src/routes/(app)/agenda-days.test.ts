import { describe, expect, test } from 'vitest';
import { agendaStream, filterByTag, groupByDay, tagsIn, withEvents } from './agenda-days';

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

	test('a holiday already under way leads the stream', () => {
		const stream = agendaStream(
			[day('2026-11-02')],
			[],
			[{ starts: '2026-10-24', ends: '2026-11-01' }]
		);

		expect(stream.map((item) => item.kind)).toEqual(['holiday', 'day']);
	});
});

describe('withEvents (ADR-0029)', () => {
	const row = (date: string, periodFrom: number) => ({ date, periodFrom });
	const event = (date: string, position: number) => ({ date, position });
	const merge = (rows: ReturnType<typeof row>[], events: ReturnType<typeof event>[]) =>
		withEvents(groupByDay(rows), events).map((d) => [
			d.date,
			d.rows.map((l) => (l.kind === 'row' ? `P${l.row.periodFrom}` : `E${l.event.position}`))
		]);

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
