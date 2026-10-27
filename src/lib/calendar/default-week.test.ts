import { describe, expect, test } from 'vitest';
import { defaultWeek } from './default-week';

// Two Teaching Weeks, then a week's break, then a third.
const weeks = [
	{ weekCommencing: '2026-11-02' },
	{ weekCommencing: '2026-11-09' },
	{ weekCommencing: '2026-11-23' }
];

describe('defaultWeek', () => {
	test.each(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'])(
		'a weekday, %s, opens on its own week',
		(on) => {
			expect(defaultWeek(weeks, on)).toBe('2026-11-02');
		}
	);

	test.each(['2026-11-07', '2026-11-08'])('a weekend day, %s, opens on the next week', (on) => {
		expect(defaultWeek(weeks, on)).toBe('2026-11-09');
	});

	test('a day in a break opens on the week after it', () => {
		expect(defaultWeek(weeks, '2026-11-18')).toBe('2026-11-23');
	});

	test('a day after the last week opens on the last week', () => {
		expect(defaultWeek(weeks, '2026-12-14')).toBe('2026-11-23');
	});

	test('no Teaching Weeks, no week', () => {
		expect(defaultWeek([], '2026-11-04')).toBeNull();
	});
});
