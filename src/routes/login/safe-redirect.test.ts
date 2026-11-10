import { describe, expect, test } from 'vitest';
import { safeRedirectTarget } from './safe-redirect';

const ORIGIN = 'https://planner.example';

describe('safeRedirectTarget', () => {
	test('a same-origin path is kept', () => {
		expect(safeRedirectTarget('/agenda', ORIGIN)).toBe('/agenda');
	});

	test('a same-origin path keeps its query string and fragment', () => {
		expect(safeRedirectTarget('/classes?tab=sequence#lessons', ORIGIN)).toBe(
			'/classes?tab=sequence#lessons'
		);
	});

	test('no redirectTo falls back to the root', () => {
		expect(safeRedirectTarget(null, ORIGIN)).toBe('/');
	});

	test('a protocol-relative URL is rejected as an open redirect', () => {
		expect(safeRedirectTarget('//evil.example', ORIGIN)).toBe('/');
	});

	test('an absolute URL is rejected', () => {
		expect(safeRedirectTarget('https://evil.example', ORIGIN)).toBe('/');
	});

	test('a backslash, which browsers read as a slash, is rejected', () => {
		expect(safeRedirectTarget('/\\evil.example', ORIGIN)).toBe('/');
	});

	test('a tab, which browsers drop, is rejected', () => {
		expect(safeRedirectTarget('/\t/evil.example', ORIGIN)).toBe('/');
	});

	test('a percent-encoded backslash is rejected once the query string has decoded it', () => {
		// `/login?redirectTo=%2F%5Cevil.example` reaches the action as `/\evil.example`.
		const target = new URLSearchParams('redirectTo=%2F%5Cevil.example').get('redirectTo');
		expect(safeRedirectTarget(target, ORIGIN)).toBe('/');
	});
});

describe('safeRedirectTarget dot segments', () => {
	// The URL parser resolves dot segments, which can leave a path that begins `//`; written into a
	// Location header, the browser reads that as another host.
	test.each([
		'/.//evil.example',
		'/..//evil.example',
		'/a/..//evil.example',
		'/%2e%2e//evil.example'
	])('%s is rejected', (target) => {
		expect(safeRedirectTarget(target, ORIGIN)).toBe('/');
	});
});
