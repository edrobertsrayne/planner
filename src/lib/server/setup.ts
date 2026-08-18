import { auth } from '$lib/server/auth';

/**
 * First-run setup. This app has exactly one user (ADR-0001), created once by /setup and recovered
 * by deleting the row — see ADR-0011.
 */

/** Whether setup has happened. Queried per request rather than cached: `reset-credentials` deletes
 * the row on a running server, and the wizard has to come back without a restart. */
export async function hasUser() {
	const ctx = await auth.$context;
	return (await ctx.internalAdapter.countTotalUsers()) > 0;
}

/**
 * Creates the single user. Goes through the internal adapter because the sign-up endpoint is
 * disabled (auth.ts) — this is the one creation path in the system, and the caller is responsible
 * for having checked that no user exists. A race loses to the `user.email` UNIQUE constraint.
 */
export async function createSingleUser(input: { email: string; password: string; name: string }) {
	const ctx = await auth.$context;

	const user = await ctx.internalAdapter.createUser({
		email: input.email,
		name: input.name,
		emailVerified: false
	});

	await ctx.internalAdapter.createAccount({
		userId: user.id,
		providerId: 'credential',
		accountId: user.id,
		password: await ctx.password.hash(input.password)
	});

	return user;
}
