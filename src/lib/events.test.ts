import { describe, expect, test } from 'vitest';
import { dayRows, type BellSchedule, type BellTime } from './bell';
import { dayRowLabel, joinAdjacentPeriods, positionRangeLabel } from './events';

const occ = (eventId: string, date: string, position: number, room: string | null = null) => ({
	eventId,
	date,
	position,
	room,
	note: null
});

const t = (starts: string, ends: string): BellTime => ({ starts, ends });

// Years 9–10 lunch after P3, Years 11–13 after P4; Break shared (see bell.test.ts).
const lower: BellSchedule = {
	id: 'lower',
	name: 'Lower',
	isDefault: true,
	times: {
		1: t('08:50', '09:50'),
		2: t('09:50', '10:50'),
		8: t('10:50', '11:10'),
		3: t('11:10', '12:10'),
		9: t('12:10', '12:40'),
		4: t('12:40', '13:40'),
		5: t('13:40', '14:40'),
		6: t('14:40', '15:40')
	}
};
const upper: BellSchedule = {
	id: 'upper',
	name: 'Upper',
	isDefault: false,
	times: { ...lower.times, 4: t('12:10', '13:10'), 9: t('13:10', '13:40') }
};

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

	test('Break and Lunch never join a Period or each other', () => {
		const joined = joinAdjacentPeriods([6, 7, 8, 9].map((p) => occ('a', '2026-11-02', p)));
		expect(joined.map((o) => [o.position, o.positionTo])).toEqual([
			[6, 6],
			[7, 7],
			[8, 8],
			[9, 9]
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

describe('dayRowLabel', () => {
	const rows = dayRows([lower, upper]);

	test('says whose Lunch it is, and leaves a shared Break unnamed', () => {
		expect(dayRowLabel(rows, 9, 'lower')).toBe('Lunch (Lower)');
		expect(dayRowLabel(rows, 9, 'upper')).toBe('Lunch (Upper)');
		expect(dayRowLabel(rows, 8, 'upper')).toBe('Break');
	});

	test('a Period and the untimed bands keep the labels they always had', () => {
		expect(dayRowLabel(rows, 4, null)).toBe('P4');
		expect(dayRowLabel(dayRows([]), 0, null)).toBe('Before school');
		expect(dayRowLabel(dayRows([]), 6, null)).toBe('P6');
		expect(dayRowLabel(dayRows([]), 7, null)).toBe('After school');
	});

	test('names the position when its Bell Schedule has gone', () => {
		expect(dayRowLabel(rows, 9, 'deleted')).toBe('Lunch');
	});
});
