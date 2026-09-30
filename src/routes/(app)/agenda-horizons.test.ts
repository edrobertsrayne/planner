import { describe, expect, test } from 'vitest';
import { parseHorizon } from './agenda-horizons';

describe('parseHorizon', () => {
	test('accepts the toggle values, including "all" (issue #281)', () => {
		expect(parseHorizon('14')).toBe(14);
		expect(parseHorizon('28')).toBe(28);
		expect(parseHorizon('all')).toBe('all');
	});

	test('gives This Week for a missing or unknown value', () => {
		expect(parseHorizon(null)).toBe(7);
		expect(parseHorizon('5')).toBe(7);
		expect(parseHorizon('ALL')).toBe(7);
	});
});
