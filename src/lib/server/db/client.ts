import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { openDatabase, runMigrations } from './index';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// The one resolved database location. Attachment storage derives its directory from it, so every
// consumer shares this module's value rather than re-reading the environment.
export const DATABASE_URL = env.DATABASE_URL;

// The build imports this module but runs no queries, and the database's folder (a mounted volume) may not exist yet.
const opened = openDatabase(building ? ':memory:' : DATABASE_URL);

if (!building) {
	removeLeftovers(DATABASE_URL);
	runMigrations(opened.client);
}

// One connection for the process's life. Restore copies the staged Backup into this database
// through the live connection (ADR-0024), so nothing has to stand in for it or reopen it.
export const client = opened.client;
export const db = opened.db;

/**
 * Deletes what a Restore that died part-way leaves beside the database: `.restore-<uuid>/`, the
 * unpacked upload, and `.backup-<uuid>.db`, a full copy of the database with the password hash in
 * it. Nothing reuses either, and a copy left in the data folder is a secret left lying around.
 */
export function removeLeftovers(databaseUrl: string) {
	const dataDir = dirname(databaseUrl);
	for (const name of readdirSync(dataDir)) {
		if (!name.startsWith('.restore-') && !name.startsWith('.backup-')) continue;
		rmSync(join(dataDir, name), { recursive: true, force: true });
	}
}
