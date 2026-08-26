import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { openDatabase, runMigrations } from './index';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const { client, db } = openDatabase(env.DATABASE_URL);

if (!building) runMigrations(client);

export { client, db };
