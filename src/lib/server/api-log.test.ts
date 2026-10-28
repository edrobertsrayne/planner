import { describe, expect, test } from 'vitest';
import { apiWriteLine } from './api-log';
import type { Zone } from './zone';

const line = (method: string, pathname: string, status: number, zone: Zone = 'api') =>
	apiWriteLine({ zone, method, pathname, status });

describe('the API write log line', () => {
	test('names the method, the path and the status of each successful write', () => {
		expect(line('POST', '/api/courses', 201)).toBe('POST /api/courses 201');
		expect(line('PATCH', '/api/lessons/abc', 200)).toBe('PATCH /api/lessons/abc 200');
		expect(line('PUT', '/api/terms', 200)).toBe('PUT /api/terms 200');
		expect(line('DELETE', '/api/links/abc', 204)).toBe('DELETE /api/links/abc 204');
	});

	test('says nothing for a read, a refusal, Better Auth or the app', () => {
		expect(line('GET', '/api/terms', 200)).toBeNull();
		expect(line('HEAD', '/api/terms', 200)).toBeNull();
		expect(line('POST', '/api/courses', 409)).toBeNull();
		expect(line('DELETE', '/api/lessons/abc', 404)).toBeNull();
		expect(line('PATCH', '/api/lessons/abc', 500)).toBeNull();
		expect(line('POST', '/api/auth/sign-in/email', 200, 'auth')).toBeNull();
		expect(line('POST', '/login?/signIn', 200, 'app')).toBeNull();
		// The zone decides, not the shape of the path.
		expect(line('POST', '/api/courses', 201, 'app')).toBeNull();
	});
});
