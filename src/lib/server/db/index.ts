import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { readMigrationFiles } from 'drizzle-orm/migrator';

const MIGRATIONS_TABLE = '__drizzle_migrations';

export function openDatabase(path: string) {
	const client = new Database(path);
	client.run('PRAGMA busy_timeout = 5000');
	client.run('PRAGMA foreign_keys = ON');
	client.run('PRAGMA journal_mode = WAL');

	return { client, db: drizzle({ client }) };
}

export function runMigrations(client: Database, migrationsFolder = 'drizzle') {
	client.run(`CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
		id INTEGER PRIMARY KEY,
		hash TEXT NOT NULL,
		created_at NUMERIC,
		name TEXT,
		applied_at TEXT
	)`);

	const applied = new Set(
		client
			.prepare<{ name: string }, []>(`SELECT name FROM ${MIGRATIONS_TABLE}`)
			.all()
			.map((row) => row.name)
	);

	const pending = readMigrationFiles({ migrationsFolder }).filter(
		(migration) => !applied.has(migration.name)
	);

	const insertMigration = client.prepare(
		`INSERT INTO ${MIGRATIONS_TABLE} (hash, created_at, name, applied_at) VALUES (?, ?, ?, ?)`
	);

	for (const migration of pending) {
		client.run('BEGIN');
		try {
			for (const statement of migration.sql) client.run(statement);
			insertMigration.run(
				migration.hash,
				migration.folderMillis,
				migration.name,
				new Date().toISOString()
			);
			client.run('COMMIT');
		} catch (cause) {
			client.run('ROLLBACK');
			throw new Error(`Migration "${migration.name}" failed: ${(cause as Error).message}`, {
				cause
			});
		}
	}
}
