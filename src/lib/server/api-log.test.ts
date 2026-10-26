import { describe, expect, test } from 'vitest';
import { apiWriteLine } from './api-log';

const line = (method: string, pathname: string, status: number) =>
	apiWriteLine({ method, pathname, status });

describe('the API write log line', () => {
	test('names the method, the path and the status of each successful write', () => {
		expect(line('POST', '/api/courses', 201)).toBe('POST /api/courses 201');
		expect(line('PATCH', '/api/lessons/abc', 200)).toBe('PATCH /api/lessons/abc 200');
		expect(line('PUT', '/api/terms', 200)).toBe('PUT /api/terms 200');
		expect(line('DELETE', '/api/links/abc', 204)).toBe('DELETE /api/links/abc 204');
	});

	test('says nothing for a read, a refusal, or the auth library', () => {
		expect(line('GET', '/api/terms', 200)).toBeNull();
		expect(line('HEAD', '/api/terms', 200)).toBeNull();
		expect(line('POST', '/api/courses', 409)).toBeNull();
		expect(line('DELETE', '/api/lessons/abc', 404)).toBeNull();
		expect(line('PATCH', '/api/lessons/abc', 500)).toBeNull();
		expect(line('POST', '/api/auth/sign-in/email', 200)).toBeNull();
		expect(line('POST', '/login?/signIn', 200)).toBeNull();
	});
});
