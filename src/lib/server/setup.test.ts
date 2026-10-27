import { describe, expect, test } from 'vitest';
import { firstRun } from './setup';

describe('firstRun', () => {
	test('runs one task at a time, in submission order', async () => {
		const log: string[] = [];
		let release!: () => void;
		const gate = new Promise<void>((resolve) => (release = resolve));

		const first = firstRun(async () => {
			log.push('first:start');
			await gate;
			log.push('first:end');
			return 1;
		});
		const second = firstRun(() => {
			log.push('second');
			return 2;
		});

		await Promise.resolve();
		expect(log).toEqual(['first:start']);

		release();
		await expect(first).resolves.toBe(1);
		await expect(second).resolves.toBe(2);
		expect(log).toEqual(['first:start', 'first:end', 'second']);
	});

	test('a failed task does not keep the queue closed', async () => {
		await expect(
			firstRun(() => {
				throw new Error('boom');
			})
		).rejects.toThrow('boom');

		await expect(firstRun(() => 'next')).resolves.toBe('next');
	});
});
