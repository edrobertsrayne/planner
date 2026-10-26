import { afterEach, describe, expect, test, vi } from 'vitest';
import { addDays, isRealDate, mondayOf, today } from './date';

describe('today', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	test('reads the Europe/London day, so a late BST evening is already tomorrow', () => {
		// 23:30 UTC on 1 July is 00:30 BST on 2 July, the day the teacher is actually living in.
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-01T23:30:00Z'));

		expect(today()).toBe('2026-07-02');
	});

	test('is the same day as UTC in winter, when London runs on GMT', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-12-01T23:30:00Z'));

		expect(today()).toBe('2026-12-01');
	});
});

describe('addDays', () => {
	test('counts forward across a month end', () => {
		expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
	});

	test('counts backwards across a month end', () => {
		expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
	});

	test('counts across a year end', () => {
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
	});

	test('counts to 29 February in a leap year', () => {
		expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
	});
});

describe('isRealDate', () => {
	test('accepts a day the calendar has', () => {
		expect(isRealDate('2026-09-03')).toBe(true);
		expect(isRealDate('2028-02-29')).toBe(true);
	});

	test('refuses a day the calendar rolls over', () => {
		expect(isRealDate('2026-02-30')).toBe(false);
		expect(isRealDate('2027-02-29')).toBe(false);
		expect(isRealDate('2026-13-01')).toBe(false);
	});

	test('refuses a shape that is not YYYY-MM-DD', () => {
		expect(isRealDate('2026-9-3')).toBe(false);
		expect(isRealDate('2026-09-03T00:00:00Z')).toBe(false);
		expect(isRealDate('')).toBe(false);
	});
});

describe('mondayOf', () => {
	// Every day from Monday 7 September 2026 to Sunday 13 September 2026, Sunday included: it
	// belongs to the week that began six days before it.
	test.each([
		'2026-09-07',
		'2026-09-08',
		'2026-09-09',
		'2026-09-10',
		'2026-09-11',
		'2026-09-12',
		'2026-09-13'
	])('%s falls in the week beginning Monday 7 September', (iso) => {
		expect(mondayOf(iso)).toBe('2026-09-07');
	});

	test('a Monday is its own Monday', () => {
		expect(mondayOf('2026-09-14')).toBe('2026-09-14');
	});
});
