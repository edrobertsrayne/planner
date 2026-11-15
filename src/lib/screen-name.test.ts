import { describe, expect, test } from 'vitest';
import { screenName } from './screen-name';

describe('screenName', () => {
	test('names the six screens and Settings by their path', () => {
		expect(screenName('/')).toBe('Agenda');
		expect(screenName('/calendar')).toBe('Calendar');
		expect(screenName('/classes')).toBe('Classes');
		expect(screenName('/events')).toBe('Events');
		expect(screenName('/courses')).toBe('Courses');
		expect(screenName('/planning')).toBe('Planning');
		expect(screenName('/settings')).toBe('Settings');
	});

	test('names a page under a screen in the singular', () => {
		expect(screenName('/classes/abc')).toBe('Class');
		expect(screenName('/events/abc')).toBe('Event');
		expect(screenName('/courses/abc')).toBe('Course');
		expect(screenName('/lessons/abc')).toBe('Lesson');
		expect(screenName('/sessions/abc/2026-11-16/3')).toBe('Session');
	});
});
