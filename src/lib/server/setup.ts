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

/** The creation in flight, if any; see `createFirstUser`. */
let creating: Promise<User | null> | null = null;

/**
 * Creates the single user, answering with it, or with null when one already exists.
 *
 * Goes through the internal adapter because the sign-up endpoint is disabled (auth.ts) — this is
 * the one creation path in the system, and it owns the check that no user exists. Two submissions
 * that arrive together share one attempt: without that, both pass the count and both insert, and
 * `user.email` UNIQUE only refuses the second when the emails happen to match.
 * `restore/+server.ts` guards its check-and-write the same way.
 */
export function createFirstUser(input: {
	email: string;
	password: string;
	name: string;
}): Promise<User | null> {
	creating ??= createOnce(input).finally(() => (creating = null));
	return creating;
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
