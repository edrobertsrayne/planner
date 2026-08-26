import { describe, expect, test } from 'vitest';
import { guardRedirect, isPublicRoute } from '$lib/server/guard';

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

const request = (overrides: Partial<Parameters<typeof guardRedirect>[0]>) =>
	guardRedirect({ pathname: '/', search: '', userExists: true, signedIn: true, ...overrides });

describe('guardRedirect', () => {
	describe('before setup', () => {
		test('sends every route to the wizard', () => {
			expect(request({ pathname: '/', userExists: false, signedIn: false })).toBe('/setup');
			expect(request({ pathname: '/calendar', userExists: false, signedIn: false })).toBe('/setup');
		});

		test('lets /api/* through even before setup (it returns 401 on its own)', () => {
			expect(request({ pathname: '/api/courses', userExists: false, signedIn: false })).toBeNull();
			expect(request({ pathname: '/api', userExists: false, signedIn: false })).toBeNull();
		});

		test('sends the login page to the wizard too — there is nothing to log in to', () => {
			expect(request({ pathname: '/login', userExists: false, signedIn: false })).toBe('/setup');
		});

		test('lets the wizard itself through', () => {
			expect(request({ pathname: '/setup', userExists: false, signedIn: false })).toBeNull();
		});
	});

	describe('after setup', () => {
		test('closes the wizard for a signed-in visitor', () => {
			expect(request({ pathname: '/setup', signedIn: true })).toBe('/');
		});

		test('sends a signed-out visitor straight to login, not through the app first', () => {
			expect(request({ pathname: '/setup', signedIn: false })).toBe('/login');
		});

		test('a route merely starting with the same letters as /setup is not the wizard', () => {
			expect(request({ pathname: '/setupextra', signedIn: false })).toMatch(/^\/login\?/);
		});

		test('sends a signed-out visitor to log in, remembering where they were going', () => {
			expect(request({ pathname: '/classes/9b', search: '?tab=topics', signedIn: false })).toBe(
				'/login?redirectTo=%2Fclasses%2F9b%3Ftab%3Dtopics'
			);
		});

		test('lets a signed-out visitor reach the login page', () => {
			expect(request({ pathname: '/login', signedIn: false })).toBeNull();
		});

		test('keeps a signed-in visitor off the login page', () => {
			expect(request({ pathname: '/login', signedIn: true })).toBe('/');
		});

		test('lets a signed-in visitor through to the app', () => {
			expect(request({ pathname: '/calendar', signedIn: true })).toBeNull();
			expect(request({ pathname: '/settings', signedIn: true })).toBeNull();
		});

		test('lets /api/* through when signed out', () => {
			expect(request({ pathname: '/api/courses', signedIn: false })).toBeNull();
			expect(request({ pathname: '/api', signedIn: false })).toBeNull();
		});

		test('lets /api/* through when signed in', () => {
			expect(request({ pathname: '/api/courses', signedIn: true })).toBeNull();
			expect(request({ pathname: '/api', signedIn: true })).toBeNull();
		});

		test('protects non-API routes when signed out', () => {
			const target = request({ pathname: '/courses', signedIn: false });
			expect(target).toContain('/login');
		});
	});
});
