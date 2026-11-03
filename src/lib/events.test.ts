import { describe, expect, test } from 'vitest';
import { joinAdjacentPeriods, positionRangeLabel } from './events';

const occ = (eventId: string, date: string, position: number, room: string | null = null) => ({
	eventId,
	date,
	position,
	room,
	note: null
});

describe('joinAdjacentPeriods', () => {
	test('one Event over adjacent Periods on a date is a single occurrence spanning them', () => {
		const joined = joinAdjacentPeriods([occ('a', '2026-11-02', 1), occ('a', '2026-11-02', 2)]);
		expect(joined).toHaveLength(1);
		expect(joined[0]).toMatchObject({ position: 1, positionTo: 2 });
	});

	test('a single position spans itself', () => {
		const [one] = joinAdjacentPeriods([occ('a', '2026-11-02', 3)]);
		expect(one).toMatchObject({ position: 3, positionTo: 3 });
	});

	test('three adjacent Periods join into one', () => {
		const joined = joinAdjacentPeriods([2, 3, 4].map((p) => occ('a', '2026-11-02', p)));
		expect(joined.map((o) => [o.position, o.positionTo])).toEqual([[2, 4]]);
	});

	test('a gap, another date or another Event keeps occurrences apart', () => {
		const joined = joinAdjacentPeriods([
			occ('a', '2026-11-02', 1),
			occ('a', '2026-11-02', 3),
			occ('b', '2026-11-02', 4),
			occ('a', '2026-11-03', 5)
		]);
		expect(joined.map((o) => [o.eventId, o.date, o.position, o.positionTo])).toEqual([
			['a', '2026-11-02', 1, 1],
			['a', '2026-11-02', 3, 3],
			['b', '2026-11-02', 4, 4],
			['a', '2026-11-03', 5, 5]
		]);
	});

	test('Before school and After school never join a Period', () => {
		const joined = joinAdjacentPeriods([
			occ('a', '2026-11-02', 0),
			occ('a', '2026-11-02', 1),
			occ('a', '2026-11-02', 6),
			occ('a', '2026-11-02', 7)
		]);
		expect(joined.map((o) => [o.position, o.positionTo])).toEqual([
			[0, 0],
			[1, 1],
			[6, 6],
			[7, 7]
		]);
	});

	test('rooms are the distinct ones held, in order', () => {
		const [same] = joinAdjacentPeriods([
			occ('a', '2026-11-02', 1, 'S12'),
			occ('a', '2026-11-02', 2, 'S12')
		]);
		expect(same.room).toBe('S12');
		const [differ] = joinAdjacentPeriods([
			occ('a', '2026-11-02', 1, 'S12'),
			occ('a', '2026-11-02', 2, 'Hall')
		]);
		expect(differ.room).toBe('S12, Hall');
		const [none] = joinAdjacentPeriods([occ('a', '2026-11-02', 1), occ('a', '2026-11-02', 2)]);
		expect(none.room).toBeNull();
	});
});

describe('positionRangeLabel', () => {
	test('names one position, or a run of Periods', () => {
		expect(positionRangeLabel(3, 3)).toBe('P3');
		expect(positionRangeLabel(1, 2)).toBe('P1–P2');
		expect(positionRangeLabel(7, 7)).toBe('After school');
	});
});
