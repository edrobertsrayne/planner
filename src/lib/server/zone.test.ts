import { describe, expect, it } from 'vitest';
import { zoneOf } from './zone';

describe('zoneOf', () => {
	it('puts every Planning API path in the api zone, with or without a trailing slash', () => {
		expect(zoneOf('/api')).toBe('api');
		expect(zoneOf('/api/')).toBe('api');
		expect(zoneOf('/api/courses')).toBe('api');
		expect(zoneOf('/api/lessons/abc/attachments')).toBe('api');
	});

	it('puts Better Auth and its children in the auth zone', () => {
		expect(zoneOf('/api/auth')).toBe('auth');
		expect(zoneOf('/api/auth/')).toBe('auth');
		expect(zoneOf('/api/auth/sign-in/email')).toBe('auth');
		expect(zoneOf('/api/auth/get-session')).toBe('auth');
	});

	it('does not mistake a path that merely starts with the same letters for the API', () => {
		expect(zoneOf('/apix')).toBe('app');
		expect(zoneOf('/apiary')).toBe('app');
		expect(zoneOf('/api/authx')).toBe('api');
	});

	it('puts pages, the wizard and the login page in the app zone', () => {
		expect(zoneOf('/')).toBe('app');
		expect(zoneOf('/setup')).toBe('app');
		expect(zoneOf('/setup/restore')).toBe('app');
		expect(zoneOf('/login')).toBe('app');
		expect(zoneOf('/calendar')).toBe('app');
	});
});

describe('zoneOf and the path SvelteKit routes', () => {
	// SvelteKit matches routes on the decoded path, so the zone must be read from it too: otherwise
	// `/%61pi/courses` is the app zone to the hooks and `/api/courses` to the router.
	it('reads a percent-encoded letter as the letter', () => {
		expect(zoneOf('/%61pi/courses')).toBe('api');
		expect(zoneOf('/%61pi/%61uth/get-session')).toBe('auth');
		expect(zoneOf('/api/%61uth/get-session')).toBe('auth');
	});

	it('keeps an encoded slash or percent inside its segment, as the router does', () => {
		expect(zoneOf('/%2Fapi/courses')).toBe('app');
		expect(zoneOf('/api%2Fcourses')).toBe('app');
		expect(zoneOf('/%2561pi/courses')).toBe('app');
	});
});
