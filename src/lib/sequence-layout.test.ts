import { describe, expect, test } from 'vitest';
import type { WeekCell, WeekRow } from '$lib/server/planner';
import { layOutSequence, movableSlotKeys, previewDiff, weekAddAnchor } from './sequence-layout';

describe('layOutSequence', () => {
	test('lays the Lessons through the Slots in order, a Length-2 Lesson in two Slots', () => {
		const { fills, pastEnd } = layOutSequence(
			['a', 'b'],
			new Map([
				['a', 1],
				['b', 2]
			]),
			['s1', 's2', 's3', 's4']
		);
		expect([...fills]).toEqual([
			['s1', { lessonId: 'a', part: 1, of: 1 }],
			['s2', { lessonId: 'b', part: 1, of: 2 }],
			['s3', { lessonId: 'b', part: 2, of: 2 }]
		]);
		expect(pastEnd).toEqual([]);
	});

	test('a Lesson with no Slot left is past the end, once', () => {
		const { fills, pastEnd } = layOutSequence(
			['a', 'b', 'c'],
			new Map([
				['a', 1],
				['b', 2],
				['c', 1]
			]),
			['s1', 's2']
		);
		expect([...fills.keys()]).toEqual(['s1', 's2']);
		expect(pastEnd).toEqual(['b', 'c']);
	});
});

const movable = (key: string): WeekCell => ({
	key,
	date: '2026-01-05',
	day: 1,
	period: 1,
	kind: 'movable'
});
const week = (cells: WeekCell[]): Extract<WeekRow, { kind: 'week' }> => ({
	kind: 'week',
	weekCommencing: '2026-01-05',
	letter: 'A',
	cells
});

describe('movableSlotKeys', () => {
	test('takes every movable Slot of the week rows, in calendar order', () => {
		const weeks: WeekRow[] = [
			week([
				movable('s1'),
				{ key: 's2', date: '2026-01-05', day: 1, period: 2, kind: 'blocked' },
				movable('s3')
			]),
			{ kind: 'holiday', from: '2026-01-12', to: '2026-01-16' },
			week([movable('s4')])
		];
		expect(movableSlotKeys(weeks)).toEqual(['s1', 's3', 's4']);
	});
});

describe('previewDiff', () => {
	const parts = new Map([
		['a', 1],
		['b', 1],
		['c', 1]
	]);

	test('marks the Lessons whose first Slot the drop would change', () => {
		const resting = layOutSequence(['a', 'b', 'c'], parts, ['s1', 's2']);
		const layout = layOutSequence(['b', 'a', 'c'], parts, ['s1', 's2']);
		expect(previewDiff(resting, layout, ['a', 'b', 'c'])).toEqual({
			changing: new Set(['a', 'b']),
			pastEndShown: ['c']
		});
	});

	test('keeps a Lesson listed past the end while the drop would push it out', () => {
		const threeParts = new Map([
			['a', 2],
			['b', 1],
			['c', 1]
		]);
		const resting = layOutSequence(['a', 'b', 'c'], threeParts, ['s1', 's2']);
		const layout = layOutSequence(['b', 'a', 'c'], threeParts, ['s1', 's2']);
		expect(previewDiff(resting, layout, ['a', 'b', 'c']).pastEndShown).toEqual(['a', 'b', 'c']);
	});
});

describe('weekAddAnchor', () => {
	const order = ['a', 'b', 'c'];

	test('puts the new Lesson in front of the first Lesson that starts in the week', () => {
		const fills = layOutSequence(order, new Map(), ['s1', 's2']).fills;
		fills.set('s1', { lessonId: 'b', part: 1, of: 1 });
		fills.set('s2', { lessonId: 'c', part: 1, of: 1 });
		expect(weekAddAnchor(week([movable('s1'), movable('s2')]), fills, order)).toEqual({
			after: 'a'
		});
	});

	test('adds at the end of the Sequence when only Open Slots are left', () => {
		const fills = layOutSequence(['a'], new Map([['a', 1]]), ['s1']).fills;
		expect(weekAddAnchor(week([movable('s2')]), fills, ['a', 'b'])).toEqual({ after: 'b' });
	});

	test('has no anchor in a week with no movable Slot', () => {
		const fills = new Map();
		expect(weekAddAnchor(week([{ ...movable('s1'), kind: 'past' }]), fills, order)).toBeNull();
	});
});
