import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';

const MIGRATIONS_TABLE = '__drizzle_migrations';

export function openDatabase(path: string) {
	const client = new DatabaseSync(path);
	client.exec('PRAGMA foreign_keys = ON');
	client.exec('PRAGMA journal_mode = WAL');
	client.exec('PRAGMA busy_timeout = 5000');

	return { client, db: drizzle({ client }) };
}

export function runMigrations(client: DatabaseSync, migrationsFolder = 'drizzle') {
	client.exec(`CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
		id INTEGER PRIMARY KEY,
		hash TEXT NOT NULL,
		created_at NUMERIC,
		name TEXT,
		applied_at TEXT
	)`);

	const applied = new Set(
		client
			.prepare(`SELECT name FROM ${MIGRATIONS_TABLE}`)
			.all()
			.map((row) => row.name as string)
	);

	const pending = readMigrationFiles({ migrationsFolder }).filter(
		(migration) => !applied.has(migration.name)
	);

	const insertMigration = client.prepare(
		`INSERT INTO ${MIGRATIONS_TABLE} (hash, created_at, name, applied_at) VALUES (?, ?, ?, ?)`
	);

	for (const migration of pending) {
		client.exec('BEGIN');
		try {
			for (const statement of migration.sql) client.exec(statement);
			insertMigration.run(
				migration.hash,
				migration.folderMillis,
				migration.name,
				new Date().toISOString()
			);
			client.exec('COMMIT');
		} catch (cause) {
			client.exec('ROLLBACK');
			throw new Error(`Migration "${migration.name}" failed: ${(cause as Error).message}`, {
				cause
			});
		}
	}
}

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const { client, db } = openDatabase(env.DATABASE_URL);

if (!building) runMigrations(client);

export { db };
