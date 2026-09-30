import { expect, test } from 'vitest';
import { BODY_LIMIT, RESTORE_PATH, bodyTooLarge } from './body-limit';

const request = (pathname: string, headers: Record<string, string>) => ({
	pathname,
	headers: new Headers(headers)
});
const length = (bytes: number) => ({ 'content-length': String(bytes) });

test('a body up to the limit is accepted and one byte over is refused', () => {
	expect(bodyTooLarge(request('/courses', length(BODY_LIMIT)))).toBe(false);
	expect(bodyTooLarge(request('/courses', length(BODY_LIMIT + 1)))).toBe(true);
});

test('a chunked body, whose size cannot be checked, is refused', () => {
	expect(bodyTooLarge(request('/courses', { 'transfer-encoding': 'chunked' }))).toBe(true);
});

test('only the Restore route takes a body over the limit', () => {
	expect(bodyTooLarge(request(RESTORE_PATH, length(BODY_LIMIT * 100)))).toBe(false);
	expect(bodyTooLarge(request('/setup', length(BODY_LIMIT * 100)))).toBe(true);
	expect(bodyTooLarge(request('/api/courses', length(BODY_LIMIT * 100)))).toBe(true);
});
