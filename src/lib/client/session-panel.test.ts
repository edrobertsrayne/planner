import { describe, expect, test } from 'vitest';
import { decodeOccasion, encodeOccasion } from './session-panel.svelte';

describe('encodeOccasion', () => {
	test('round-trips an occasion through decodeOccasion', () => {
		const occasion = { classId: 'cls_abc', date: '2026-08-23', period: 3 };
		expect(decodeOccasion(encodeOccasion(occasion))).toEqual(occasion);
	});
});

describe('decodeOccasion', () => {
	test('accepts null and empty as "no Session open"', () => {
		expect(decodeOccasion(null)).toBeNull();
		expect(decodeOccasion('')).toBeNull();
	});

	test('rejects values missing a part', () => {
		expect(decodeOccasion('cls_abc')).toBeNull();
		expect(decodeOccasion('cls_abc~2026-08-23')).toBeNull();
		expect(decodeOccasion('~2026-08-23~2')).toBeNull();
		expect(decodeOccasion('cls_abc~~2')).toBeNull();
		expect(decodeOccasion('cls_abc~2026-08-23~')).toBeNull();
	});

	test('rejects a non-integer Period', () => {
		expect(decodeOccasion('cls_abc~2026-08-23~two')).toBeNull();
		expect(decodeOccasion('cls_abc~2026-08-23~1.5')).toBeNull();
	});

	test('rejects values carrying more than the three parts', () => {
		expect(decodeOccasion('cls_abc~2026-08-23~2~extra')).toBeNull();
	});
});
