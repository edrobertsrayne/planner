import type { User } from 'better-auth';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import * as schema from '$lib/server/db/schema';

/**
 * First-run setup. This app has exactly one user (ADR-0001), created once by /setup and recovered
 * by deleting the row — see ADR-0011.
 */

/** Whether setup has happened. Queried per request rather than cached: `reset-credentials` deletes
 * the row on a running server, and the wizard has to come back without a restart.
 *
 * The count is one row, so it is read straight from the table. Going through the auth library
 * needed its per-request state, which the guard runs outside — and the guard runs on every request,
 * so a read that cannot fail there is worth the one query it already cost. */
export async function hasUser() {
	const [row] = db.select({ id: schema.user.id }).from(schema.user).limit(1).all();
	return row !== undefined;
}

/**
 * The one queue for work that may create the first user. Restore and the wizard both check that
 * the instance is empty and then write; serialised, the second check sees what the first wrote.
 *
 * The queue is a promise chain, kept as settled however a task ends: a failed task must not stop
 * the tasks behind it, and the caller still gets its own task's failure.
 */
let tail: Promise<unknown> = Promise.resolve();

/** Runs `work` after every task submitted before it, and answers with its result. */
export function firstRun<T>(work: () => T | PromiseLike<T>): Promise<T> {
	const result = tail.then(work);
	tail = result.then(
		() => undefined,
		() => undefined
	);
	return result;
}

/**
 * Creates the single user, answering with it, or with null when one already exists.
 *
 * Goes through the internal adapter because the sign-up endpoint is disabled (auth.ts) — this is
 * the one creation path in the system, and it owns the check that no user exists. Two submissions
 * that arrive together are queued, so the second count sees the first insert and answers null;
 * without that, both pass the count and both insert, and `user.email` UNIQUE only refuses the
 * second when the emails happen to match.
 * `restore/+server.ts` uses the same queue, so a Restore and a sign-up cannot both pass an empty
 * check.
 */
export function createFirstUser(input: {
	email: string;
	password: string;
	name: string;
}): Promise<User | null> {
	return firstRun(() => createOnce(input));
}

async function createOnce(input: {
	email: string;
	password: string;
	name: string;
}): Promise<User | null> {
	const ctx = await auth.$context;
	if ((await ctx.internalAdapter.countTotalUsers()) > 0) return null;

	const user = await ctx.internalAdapter.createUser({
		email: input.email,
		name: input.name,
		emailVerified: false
	});

	try {
		await ctx.internalAdapter.createAccount({
			userId: user.id,
			providerId: 'credential',
			accountId: user.id,
			password: await ctx.password.hash(input.password)
		});
	} catch (cause) {
		// A user with no account cannot sign in, and `hasUser` keeps the wizard away while the row
		// exists — so undo the insert before reporting the failure.
		await ctx.internalAdapter.deleteUser(user.id);
		throw cause;
	}

	return user;
}
