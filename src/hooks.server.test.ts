import { describe, expect, test } from 'vitest';
import { isPublicRoute } from './hooks.server';

describe('isPublicRoute', () => {
	test('the login page is public', () => {
		expect(isPublicRoute('/login')).toBe(true);
	});

	test('a login sub-path is public', () => {
		expect(isPublicRoute('/login/whatever')).toBe(true);
	});

	test('any other route is protected by default', () => {
		expect(isPublicRoute('/')).toBe(false);
		expect(isPublicRoute('/some/new/route/nobody/wrote/auth/code/for')).toBe(false);
	});

	test('a route merely starting with the same letters as /login is not public', () => {
		expect(isPublicRoute('/loginextra')).toBe(false);
	});
});
