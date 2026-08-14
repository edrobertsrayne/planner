/**
 * Creates the single user. Run once, after migrations, then discard the password. Runs under
 * plain node (not bun — bun has no node:sqlite), from the repo root so DATABASE_URL resolves:
 *
 *   PLANNER_USER_EMAIL=ed@example.com PLANNER_USER_PASSWORD=... \
 *     DATABASE_URL=local.db BETTER_AUTH_SECRET=... BETTER_AUTH_URL=http://localhost:5173 \
 *     node scripts/seed-user.ts
 *
 * Idempotent: refuses to run again once any user row exists, enforcing the single-user invariant.
 */
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import * as authSchema from '../src/lib/server/db/auth.schema.ts';

const databaseUrl = process.env.DATABASE_URL;
const email = process.env.PLANNER_USER_EMAIL;
const password = process.env.PLANNER_USER_PASSWORD;
const name = process.env.PLANNER_USER_NAME ?? 'Planner';

if (!databaseUrl) throw new Error('DATABASE_URL is not set');
if (!email || !password) {
	throw new Error('PLANNER_USER_EMAIL and PLANNER_USER_PASSWORD are required');
}

const client = new DatabaseSync(databaseUrl);
client.exec('PRAGMA foreign_keys = ON');
const db = drizzle({ client });

const existing = client.prepare('SELECT email FROM user LIMIT 1').get() as
	{ email: string } | undefined;
if (existing) {
	console.log(`A user already exists (${existing.email}); nothing to do.`);
	process.exit(0);
}

// A throwaway instance with sign-up enabled, built directly against process.env rather than the
// app's exported `auth` — the production instance never enables sign-up. Never served.
const seedAuth = betterAuth({
	secret: process.env.BETTER_AUTH_SECRET,
	baseURL: process.env.BETTER_AUTH_URL,
	database: drizzleAdapter(db, { provider: 'sqlite', schema: authSchema }),
	emailAndPassword: { enabled: true },
	// Must match src/lib/server/auth.ts — the domain's own `session` table means better-auth's
	// login session is renamed to avoid a collision.
	session: { modelName: 'authSession' }
});

await seedAuth.api.signUpEmail({ body: { email, password, name } });
console.log(`Created ${email}.`);
