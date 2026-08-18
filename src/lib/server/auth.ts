import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import * as authSchema from '$lib/server/db/auth.schema';

// SvelteKit's adapter-node needs ORIGIN to build event.url; better-auth needs BETTER_AUTH_URL
// (baseURL) to match event.url.origin or its handler never mounts and auth 404s with no error.
// The two are separate env vars set independently at deploy time, so a startup check is the only
// thing standing between a mismatch and a silently dead login.
export function assertOriginMatchesAuthUrl(
	origin: string | undefined,
	betterAuthUrl: string | undefined
) {
	if (!origin) throw new Error('ORIGIN is not set');
	if (!betterAuthUrl) throw new Error('BETTER_AUTH_URL is not set');
	if (origin !== betterAuthUrl) {
		throw new Error(
			`ORIGIN (${origin}) and BETTER_AUTH_URL (${betterAuthUrl}) must match exactly, or auth silently 404s.`
		);
	}
}

assertOriginMatchesAuthUrl(env.ORIGIN, env.BETTER_AUTH_URL);

export const auth = betterAuth({
	baseURL: env.BETTER_AUTH_URL,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'sqlite', schema: authSchema }),
	// Sign-up is closed at the endpoint, permanently: `/api/auth/*` is short-circuited straight to
	// better-auth by svelteKitHandler, so hooks.server.ts never sees it and cannot guard it. The
	// single user is created once, by /setup, through the internal adapter — see setup.ts.
	emailAndPassword: { enabled: true, disableSignUp: true },
	// The domain has its own `session` table (a taught occasion, ADR-0002) — better-auth's
	// login session is renamed to avoid a table-name collision.
	session: { modelName: 'authSession' },
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
