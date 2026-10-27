import { describe, expect, test } from 'vitest';
import { agendaStream, filterByTag, groupByDay, tagsIn } from './agenda-days';

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
