import { describe, expect, test } from 'vitest';
import { createSignInThrottle, type SignInThrottle } from './login-throttle';

const wrong = async () => false;
const right = async () => true;

async function fail(throttle: SignInThrottle, times: number, at: number) {
	for (let i = 0; i < times; i++) await throttle.attempt(wrong, at + i);
}

// The rule ADR-0011 records: five failures inside fifteen minutes lock /login for a minute, and a
// success clears the count.
describe('the sign-in throttle', () => {
	const start = 1_000_000;

	test('refuses nothing below five failures', async () => {
		const throttle = createSignInThrottle();
		await fail(throttle, 4, start);
		expect(await throttle.attempt(right, start + 4)).toBe('signedIn');
	});

	test('locks on the fifth failure, refusing even the right password for a minute', async () => {
		const throttle = createSignInThrottle();
		await fail(throttle, 5, start);

		expect(await throttle.attempt(right, start + 5)).toBe('locked');
		expect(await throttle.attempt(right, start + 30_000)).toBe('locked');
		expect(await throttle.attempt(right, start + 5 + 60_000)).toBe('signedIn');
	});

	test('after the wait, the count starts again rather than locking on the next attempt', async () => {
		const throttle = createSignInThrottle();
		await fail(throttle, 5, start);

		const afterWait = start + 5 + 60_000;
		// One more failure does not re-lock: the old five were cleared with the lock.
		expect(await throttle.attempt(wrong, afterWait)).toBe('failed');
		expect(await throttle.attempt(right, afterWait + 1)).toBe('signedIn');
	});

	test('failures older than the window do not count', async () => {
		const throttle = createSignInThrottle();
		await fail(throttle, 4, start);

		// The fifth failure arrives twenty minutes later, when the first four have aged out.
		const later = start + 20 * 60 * 1000;
		expect(await throttle.attempt(wrong, later)).toBe('failed');
		expect(await throttle.attempt(right, later + 1)).toBe('signedIn');
	});

	test('a successful sign-in clears the count', async () => {
		const throttle = createSignInThrottle();
		await fail(throttle, 4, start);
		expect(await throttle.attempt(right, start + 4)).toBe('signedIn');

		await fail(throttle, 4, start + 5);
		expect(await throttle.attempt(right, start + 9)).toBe('signedIn');
	});
});

// The password check awaits a hash, so attempts that arrive together would all be checked against
// the lock before any failure was recorded; `attempt` makes them take turns.
describe('concurrent sign-in attempts', () => {
	test('a burst of wrong passwords tests five, then refuses the rest without testing them', async () => {
		const throttle = createSignInThrottle();
		let tested = 0;
		const slowWrong = async () => {
			tested++;
			await Promise.resolve();
			return false;
		};

		const results = await Promise.all(
			Array.from({ length: 50 }, () => throttle.attempt(slowWrong))
		);

		expect(tested).toBe(5);
		expect(results.filter((r) => r === 'failed')).toHaveLength(5);
		expect(results.filter((r) => r === 'locked')).toHaveLength(45);
	});

	test('an attempt that throws does not stall the ones behind it', async () => {
		const throttle = createSignInThrottle();
		const broken = throttle.attempt(async () => {
			throw new Error('database gone');
		});
		const next = throttle.attempt(right);

		await expect(broken).rejects.toThrow('database gone');
		expect(await next).toBe('signedIn');
	});
});
