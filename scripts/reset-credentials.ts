/**
 * Recovers a locked-out planner. Deletes the single user, so the next request hits the setup gate
 * and the first-run wizard runs again. There is no password reset inside the app — see ADR-0011.
 *
 * Runs under bun, from the repo root:
 *
 *   DATABASE_URL=local.db bun scripts/reset-credentials.ts
 *
 * No better-auth import and no password hashing: /setup is the only path that creates a user, so
 * first-run and recovery exercise the same code and cannot drift apart.
 */
import { Database } from 'bun:sqlite';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const client = new Database(databaseUrl);
// `account` and `auth_session` reference `user` ON DELETE CASCADE; nothing else in the schema
// references it at all. Without this pragma the cascade does not fire and the delete fails.
client.run('PRAGMA foreign_keys = ON');

const existing = client.prepare('SELECT email FROM user LIMIT 1').get() as
	{ email: string } | undefined;

if (!existing) {
	console.log('No user exists — open the app and the setup wizard will run.');
	process.exit(0);
}

client.prepare('DELETE FROM user').run();

console.log(`Deleted the account for ${existing.email}, and logged out every device.`);
console.log('Your courses, classes, sessions and calendar are untouched.');
console.log('Open the app to set new credentials.');
