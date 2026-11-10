import { describe, expect, test } from 'vitest';
import { createSignInThrottle } from './login-throttle';

// The rule ADR-0011 records: five failures inside fifteen minutes lock /login for a minute, and a
// success clears the count.
describe('the sign-in throttle', () => {
	const start = 1_000_000;

	test('refuses nothing below five failures', () => {
		const throttle = createSignInThrottle();
		for (let i = 0; i < 4; i++) throttle.failed(start + i);
		expect(throttle.locked(start + 4)).toBe(false);
	});

	test('locks on the fifth failure, refusing even the right password for a minute', () => {
		const throttle = createSignInThrottle();
		for (let i = 0; i < 5; i++) throttle.failed(start + i);

		expect(throttle.locked(start + 5)).toBe(true);
		expect(throttle.locked(start + 30_000)).toBe(true);
		expect(throttle.locked(start + 5 + 60_000)).toBe(false);
	});

	test('after the wait, the count starts again rather than locking on the next attempt', () => {
		const throttle = createSignInThrottle();
		for (let i = 0; i < 5; i++) throttle.failed(start + i);

		const afterWait = start + 5 + 60_000;
		expect(throttle.locked(afterWait)).toBe(false);
		// One more failure does not re-lock: the old five were cleared with the lock.
		throttle.failed(afterWait);
		expect(throttle.locked(afterWait + 1)).toBe(false);
	});

	test('failures older than the window do not count', () => {
		const throttle = createSignInThrottle();
		const old = start;
		for (let i = 0; i < 4; i++) throttle.failed(old + i);

		// The fifth failure arrives twenty minutes later, when the first four have aged out.
		throttle.failed(old + 20 * 60 * 1000);
		expect(throttle.locked(old + 20 * 60 * 1000 + 1)).toBe(false);
	});

	test('a successful sign-in clears the count and any lock', () => {
		const throttle = createSignInThrottle();
		for (let i = 0; i < 5; i++) throttle.failed(start + i);
		expect(throttle.locked(start + 5)).toBe(true);

		throttle.signedIn();
		expect(throttle.locked(start + 5)).toBe(false);
		for (let i = 0; i < 4; i++) throttle.failed(start + 6 + i);
		expect(throttle.locked(start + 10)).toBe(false);
	});
});

// The password check awaits a hash, so attempts that arrive together would all pass `locked()`
// before any failure is recorded; `attempt` makes them take turns.
describe('concurrent sign-in attempts', () => {
	test('a burst of wrong passwords tests five, then refuses the rest without testing them', async () => {
		const throttle = createSignInThrottle();
		let tested = 0;
		const wrong = async () => {
			tested++;
			await Promise.resolve();
			return false;
		};

		const results = await Promise.all(Array.from({ length: 50 }, () => throttle.attempt(wrong)));

		expect(tested).toBe(5);
		expect(results.filter((r) => r === 'failed')).toHaveLength(5);
		expect(results.filter((r) => r === 'locked')).toHaveLength(45);
	});

	test('a right password signs in and clears the count', async () => {
		const throttle = createSignInThrottle();
		for (let i = 0; i < 4; i++) await throttle.attempt(async () => false);

		expect(await throttle.attempt(async () => true)).toBe('signedIn');
		for (let i = 0; i < 4; i++) await throttle.attempt(async () => false);
		expect(await throttle.attempt(async () => true)).toBe('signedIn');
	});

	test('an attempt that throws does not stall the ones behind it', async () => {
		const throttle = createSignInThrottle();
		const broken = throttle.attempt(async () => {
			throw new Error('database gone');
		});
		const next = throttle.attempt(async () => true);

		await expect(broken).rejects.toThrow('database gone');
		expect(await next).toBe('signedIn');
	});
});
