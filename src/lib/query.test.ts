import { describe, expect, test } from 'vitest';
import { withParam } from './query';

// A filter chip's value lives in the query string (issue #338), so it survives a reload and a
// Back into the page. Setting one filter must keep the others: the Agenda's horizon and
// look-back share their address with its Tag filter (issue #340).
describe('withParam', () => {
	test('sets the parameter on the page address', () => {
		expect(withParam(new URL('https://planner.test/planning'), 'class', 'c1')).toBe(
			'/planning?class=c1'
		);
	});

	test('clears the parameter and leaves the address clean', () => {
		expect(withParam(new URL('https://planner.test/planning?class=c1'), 'class', null)).toBe(
			'/planning'
		);
	});

	test('keeps the other parameters', () => {
		expect(
			withParam(new URL('https://planner.test/?horizon=week&past=1'), 'tag', 'Practical')
		).toBe('/?horizon=week&past=1&tag=Practical');
	});

	test('a value with a spare key in it reads back unchanged', () => {
		const href = withParam(new URL('https://planner.test/'), 'tag', 'Practical & fun');
		expect(new URL(href, 'https://planner.test').searchParams.get('tag')).toBe('Practical & fun');
	});
});
