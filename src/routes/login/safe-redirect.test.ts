import { describe, expect, test } from 'vitest';
import { safeRedirectTarget } from './safe-redirect';

describe('safeRedirectTarget', () => {
	test('a same-origin path is kept', () => {
		expect(safeRedirectTarget('/agenda')).toBe('/agenda');
	});

	test('no redirectTo falls back to the root', () => {
		expect(safeRedirectTarget(null)).toBe('/');
	});

	test('a protocol-relative URL is rejected as an open redirect', () => {
		expect(safeRedirectTarget('//evil.example')).toBe('/');
	});

	test('an absolute URL is rejected', () => {
		expect(safeRedirectTarget('https://evil.example')).toBe('/');
	});
});
