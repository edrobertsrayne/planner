import { describe, expect, test } from 'vitest';
import { assertOriginMatchesAuthUrl } from './auth';

describe('assertOriginMatchesAuthUrl', () => {
	test('refuses to start when ORIGIN and BETTER_AUTH_URL disagree, naming both', () => {
		expect(() =>
			assertOriginMatchesAuthUrl('https://planner.greensroad.uk', 'http://localhost:5173')
		).toThrow(
			/ORIGIN.*https:\/\/planner\.greensroad\.uk.*BETTER_AUTH_URL.*http:\/\/localhost:5173/s
		);
	});

	test('starts normally when they match', () => {
		expect(() =>
			assertOriginMatchesAuthUrl('http://localhost:5173', 'http://localhost:5173')
		).not.toThrow();
	});

	test('refuses to start when either is unset', () => {
		expect(() => assertOriginMatchesAuthUrl(undefined, 'http://localhost:5173')).toThrow(/ORIGIN/);
		expect(() => assertOriginMatchesAuthUrl('http://localhost:5173', undefined)).toThrow(
			/BETTER_AUTH_URL/
		);
	});
});
