import { describe, expect, it } from 'vitest';
import { crossSiteFormRefused, guardRedirect, isPublicRoute } from './guard';

const site = 'https://planner.example';
const form = {
	zone: 'app' as const,
	method: 'POST',
	pathname: '/courses',
	contentType: 'multipart/form-data; boundary=x'
};

describe('crossSiteFormRefused', () => {
	it('refuses a form write from another origin, or with no origin, outside /api', () => {
		expect(
			crossSiteFormRefused({ ...form, origin: 'https://evil.example', siteOrigin: site })
		).toBe(true);
		expect(crossSiteFormRefused({ ...form, origin: null, siteOrigin: site })).toBe(true);
	});

	it('lets a same-origin form write, a JSON write and a read through', () => {
		expect(crossSiteFormRefused({ ...form, origin: site, siteOrigin: site })).toBe(false);
		expect(
			crossSiteFormRefused({
				...form,
				contentType: 'application/json',
				origin: 'https://evil.example',
				siteOrigin: site
			})
		).toBe(false);
		expect(crossSiteFormRefused({ ...form, method: 'GET', origin: null, siteOrigin: site })).toBe(
			false
		);
	});

	it('leaves both API zones to their own checks, so a script can upload with no origin', () => {
		expect(
			crossSiteFormRefused({
				...form,
				zone: 'api',
				pathname: '/api/lessons/1/attachments',
				origin: null,
				siteOrigin: site
			})
		).toBe(false);
		expect(
			crossSiteFormRefused({
				...form,
				zone: 'auth',
				pathname: '/api/auth/sign-in/email',
				origin: null,
				siteOrigin: site
			})
		).toBe(false);
	});
});

describe('isPublicRoute', () => {
	it('the login page is public', () => {
		expect(isPublicRoute('/login')).toBe(true);
	});

	it('a login sub-path is public', () => {
		expect(isPublicRoute('/login/whatever')).toBe(true);
	});

	it('any other route is protected by default', () => {
		expect(isPublicRoute('/')).toBe(false);
		expect(isPublicRoute('/some/new/route/nobody/wrote/auth/code/for')).toBe(false);
	});

	it('a route merely starting with the same letters as /login is not public', () => {
		expect(isPublicRoute('/loginextra')).toBe(false);
	});
});

const request = (overrides: Partial<Parameters<typeof guardRedirect>[0]>) =>
	guardRedirect({
		zone: 'app',
		pathname: '/',
		search: '',
		userExists: true,
		signedIn: true,
		...overrides
	});

describe('guardRedirect', () => {
	describe('before setup', () => {
		it('sends every route to the wizard', () => {
			expect(request({ pathname: '/', userExists: false, signedIn: false })).toBe('/setup');
			expect(request({ pathname: '/calendar', userExists: false, signedIn: false })).toBe('/setup');
		});

		it('lets the API zones through even before setup (they answer on their own)', () => {
			expect(
				request({
					zone: 'api',
					pathname: '/api/courses',
					userExists: false,
					signedIn: false
				})
			).toBeNull();
			expect(
				request({ zone: 'api', pathname: '/api', userExists: false, signedIn: false })
			).toBeNull();
			expect(
				request({
					zone: 'auth',
					pathname: '/api/auth/sign-in/email',
					userExists: false,
					signedIn: false
				})
			).toBeNull();
		});

		it('sends the login page to the wizard too — there is nothing to log in to', () => {
			expect(request({ pathname: '/login', userExists: false, signedIn: false })).toBe('/setup');
		});

		it('lets the wizard itself through', () => {
			expect(request({ pathname: '/setup', userExists: false, signedIn: false })).toBeNull();
		});
	});

	describe('after setup', () => {
		it('closes the wizard for a signed-in visitor', () => {
			expect(request({ pathname: '/setup', signedIn: true })).toBe('/');
		});

		it('sends a signed-out visitor straight to login, not through the app first', () => {
			expect(request({ pathname: '/setup', signedIn: false })).toBe('/login');
		});

		it('a route merely starting with the same letters as /setup is not the wizard', () => {
			expect(request({ pathname: '/setupextra', signedIn: false })).toMatch(/^\/login\?/);
		});

		it('sends a signed-out visitor to log in, remembering where they were going', () => {
			expect(request({ pathname: '/classes/9b', search: '?tab=topics', signedIn: false })).toBe(
				'/login?redirectTo=%2Fclasses%2F9b%3Ftab%3Dtopics'
			);
		});

		it('lets a signed-out visitor reach the login page', () => {
			expect(request({ pathname: '/login', signedIn: false })).toBeNull();
		});

		it('keeps a signed-in visitor off the login page', () => {
			expect(request({ pathname: '/login', signedIn: true })).toBe('/');
		});

		it('lets a signed-in visitor through to the app', () => {
			expect(request({ pathname: '/calendar', signedIn: true })).toBeNull();
			expect(request({ pathname: '/settings', signedIn: true })).toBeNull();
		});

		it('lets the API zones through when signed out', () => {
			expect(request({ zone: 'api', pathname: '/api/courses', signedIn: false })).toBeNull();
			expect(request({ zone: 'api', pathname: '/api', signedIn: false })).toBeNull();
			expect(
				request({ zone: 'auth', pathname: '/api/auth/get-session', signedIn: false })
			).toBeNull();
		});

		it('lets /api/* through when signed in', () => {
			expect(request({ pathname: '/api/courses', signedIn: true })).toBeNull();
			expect(request({ pathname: '/api', signedIn: true })).toBeNull();
		});

		it('protects non-API routes when signed out', () => {
			const target = request({ pathname: '/courses', signedIn: false });
			expect(target).toContain('/login');
		});
	});
});
