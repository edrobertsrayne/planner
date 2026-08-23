import { describe, expect, test } from 'vitest';
import { groupByDay, horizonEndsOn } from './agenda-days';

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

describe('horizonEndsOn', () => {
	// The window is calendar days from today, today counting as the first — the same arithmetic
	// `agenda` applies when it filters, so the prose names the day the horizon actually reaches.
	test('the last day of a horizon is horizonDays − 1 after today', () => {
		expect(horizonEndsOn('2026-09-03', 1)).toBe('2026-09-03');
		expect(horizonEndsOn('2026-09-03', 7)).toBe('2026-09-09');
		expect(horizonEndsOn('2026-09-28', 28)).toBe('2026-10-25');
	});
});
