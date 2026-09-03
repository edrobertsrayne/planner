import { describe, expect, test } from 'vitest';
import { formatSize } from './format-size';

// The size an Attachment row shows beside its filename — read at a glance while telling two
// files apart, so bytes stay formatted, never raw.
describe('formatSize', () => {
	test('sizes under a kilobyte stay in bytes', () => {
		expect(formatSize(0)).toBe('0 B');
		expect(formatSize(1)).toBe('1 B');
		expect(formatSize(1023)).toBe('1023 B');
	});

	test('below ten units the size shows one decimal', () => {
		expect(formatSize(1024)).toBe('1.0 kB');
		expect(formatSize(1536)).toBe('1.5 kB');
		expect(formatSize(1024 * 1024)).toBe('1.0 MB');
		expect(formatSize(5 * 1024 * 1024)).toBe('5.0 MB');
	});

	test('from ten units up the size is a whole figure', () => {
		expect(formatSize(512 * 1024)).toBe('512 kB');
		expect(formatSize(10 * 1024 * 1024)).toBe('10 MB');
	});
});
