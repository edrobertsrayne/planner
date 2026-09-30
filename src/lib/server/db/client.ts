import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { openDatabase, runMigrations } from './index';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// The one resolved database location. Attachment storage derives its directory from it, so every
// consumer shares this module's value rather than re-reading the environment.
export const DATABASE_URL = env.DATABASE_URL;

let current = openDatabase(DATABASE_URL);

if (!building) runMigrations(current.client);

// Restore replaces the database file under a running server (ADR-0024), and the auth library keeps
// hold of `db` from start-up. So `client` and `db` are stable stand-ins that forward every access
// to whichever connection is current, and `reopenDatabase` swaps that connection.
function forwarding<T extends object>(target: () => T): T {
	return new Proxy({} as T, {
		get(_, property) {
			const value = Reflect.get(target(), property);
			return typeof value === 'function' ? value.bind(target()) : value;
		}
	});
}

export const client = forwarding(() => current.client);
export const db = forwarding(() => current.db);

export function closeDatabase() {
	current.client.close();
}

export function reopenDatabase() {
	current = openDatabase(DATABASE_URL);
	runMigrations(current.client);
}
