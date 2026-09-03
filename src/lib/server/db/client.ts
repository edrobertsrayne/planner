import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { openDatabase, runMigrations } from './index';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// The one resolved database location. Attachment storage derives its directory from it, so every
// consumer shares this module's value rather than re-reading the environment.
export const DATABASE_URL = env.DATABASE_URL;

const { client, db } = openDatabase(DATABASE_URL);

if (!building) runMigrations(client);

export { client, db };
