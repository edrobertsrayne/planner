import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { openDatabase, runMigrations } from './index';
import * as schema from './schema';

let dir: string;

afterEach(() => {
	if (dir) rmSync(dir, { recursive: true, force: true });
});

test('booting against a fresh empty file produces the complete schema', () => {
	dir = mkdtempSync(join(tmpdir(), 'planner-db-'));
	const { client, db } = openDatabase(join(dir, 'fresh.db'));

	runMigrations(client, 'drizzle');

	const tables = client
		.prepare<{ name: string }, []>(
			"SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
		)
		.all()
		.map((row) => row.name);

	for (const expected of [
		'course',
		'topic',
		'lesson',
		'link',
		'class',
		'assigned_topic',
		'slot',
		'session',
		'term',
		'teaching_week',
		'blocked_day',
		'blocked_slot',
		'user',
		'auth_session',
		'account',
		'verification'
	]) {
		expect(tables).toContain(expected);
	}

	expect(() => db.select().from(schema.course).all()).not.toThrow();
});

test('a foreign key violation is rejected', () => {
	dir = mkdtempSync(join(tmpdir(), 'planner-db-'));
	const { client, db } = openDatabase(join(dir, 'fk.db'));
	runMigrations(client, 'drizzle');

	let error: unknown;
	try {
		db.insert(schema.topic).values({ name: 'Forces', courseId: 'does-not-exist' }).run();
	} catch (thrown) {
		error = thrown;
	}

	expect(error).toBeInstanceOf(Error);
	expect((error as Error & { cause?: Error }).cause?.message ?? (error as Error).message).toMatch(
		/FOREIGN KEY constraint failed/i
	);
});

describe('runMigrations', () => {
	test('refuses to apply a broken migration, naming which one failed', () => {
		dir = mkdtempSync(join(tmpdir(), 'planner-db-'));
		const migrationsFolder = join(dir, 'migrations');
		const migrationName = '20990101000000_broken';
		mkdirSync(join(migrationsFolder, migrationName), { recursive: true });
		writeFileSync(join(migrationsFolder, migrationName, 'migration.sql'), 'THIS IS NOT SQL;');

		const { client } = openDatabase(join(dir, 'broken.db'));

		expect(() => runMigrations(client, migrationsFolder)).toThrow(
			new RegExp(`Migration "${migrationName}" failed`)
		);
	});
});
