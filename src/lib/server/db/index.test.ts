import { cpSync, mkdtempSync, mkdirSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { openDatabase, inTransaction, runMigrations } from './index';
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
		'tag',
		'lesson_tag',
		'attachment',
		'class',
		'class_lesson',
		'teaching_note',
		'slot',
		'session',
		'term',
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

test('the Sequence migration resets the plan and keeps content and the calendar', () => {
	dir = mkdtempSync(join(tmpdir(), 'planner-db-'));
	const { client } = openDatabase(join(dir, 'sequence-migration.db'));
	const last = '20261015000000_class_sequence';

	// Every migration before the Sequence one, in a folder of its own.
	const folder = join(dir, 'migrations');
	mkdirSync(folder);
	for (const name of readdirSync('drizzle')) {
		if (name !== last) cpSync(join('drizzle', name), join(folder, name), { recursive: true });
	}
	runMigrations(client, folder);

	const run = (sql: string) => client.prepare(sql).run();
	run("INSERT INTO course (id, name) VALUES ('c1', 'Physics')");
	run("INSERT INTO topic (id, name, course_id) VALUES ('t1', 'Forces', 'c1')");
	run("INSERT INTO lesson (id, topic_id, title, position) VALUES ('l1', 't1', 'Speed', 1)");
	run("INSERT INTO class (id, label, course_id) VALUES ('k1', '9A', 'c1')");
	run("INSERT INTO slot (id, class_id, week, day, period) VALUES ('s1', 'k1', 'A', 1, 1)");
	run("INSERT INTO term (id, opens, closes) VALUES ('tm1', '2026-09-01', '2026-12-18')");
	run("INSERT INTO blocked_day (id, date) VALUES ('b1', '2026-10-01')");
	run("INSERT INTO assigned_topic (id, class_id, topic_id, position) VALUES ('a1', 'k1', 't1', 1)");
	run(
		"INSERT INTO session (id, class_id, date, period, lesson_id, note) VALUES ('x1', 'k1', '2026-09-03', 1, 'l1', 'went well')"
	);
	run("INSERT INTO continuation (id, session_id) VALUES ('co1', 'x1')");
	run(
		"INSERT INTO placement (id, class_id, date, slot_id, lesson_id) VALUES ('p1', 'k1', '2026-09-10', 's1', 'l1')"
	);
	run("INSERT INTO readiness (id, lesson_id, class_id) VALUES ('r1', 'l1', 'k1')");

	cpSync(join('drizzle', last), join(folder, last), { recursive: true });
	runMigrations(client, folder);

	const count = (table: string) =>
		(client.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
	for (const kept of ['course', 'topic', 'lesson', 'class', 'slot', 'term', 'blocked_day'])
		expect(count(kept), kept).toBe(1);
	for (const emptied of [
		'continuation',
		'session',
		'placement',
		'readiness',
		'class_lesson',
		'teaching_note'
	])
		expect(count(emptied), emptied).toBe(0);

	const names = (sql: string) =>
		client
			.prepare<{ name: string }, []>(sql)
			.all()
			.map((row) => row.name);
	expect(names("SELECT name FROM sqlite_master WHERE type = 'table'")).not.toContain(
		'assigned_topic'
	);
	expect(names("SELECT name FROM pragma_table_info('session')")).not.toContain('note');
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

	test('a migration that rebuilds a parent table keeps its child rows', () => {
		dir = mkdtempSync(join(tmpdir(), 'planner-db-'));
		const { client } = openDatabase(join(dir, 'rebuild.db'));
		runMigrations(client, 'drizzle');

		client.run("INSERT INTO course (id, name, tone) VALUES ('c1', 'Physics', 0)");
		client.run("INSERT INTO topic (id, name, course_id) VALUES ('t1', 'Forces', 'c1')");
		client.run("INSERT INTO class (id, label, course_id) VALUES ('k1', '9A', 'c1')");

		const migrationsFolder = join(dir, 'migrations');
		const migrationName = '20990202000000_rebuild_course';
		mkdirSync(join(migrationsFolder, migrationName), { recursive: true });
		writeFileSync(
			join(migrationsFolder, migrationName, 'migration.sql'),
			`CREATE TABLE course_new (id text PRIMARY KEY, name text NOT NULL, tone integer DEFAULT 0 NOT NULL);
			INSERT INTO course_new SELECT id, name, tone FROM course;
			DROP TABLE course;
			ALTER TABLE course_new RENAME TO course;`
		);

		runMigrations(client, migrationsFolder);

		const count = (table: string) =>
			(client.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
		expect(count('course')).toBe(1);
		expect(count('topic')).toBe(1);
		expect(count('class')).toBe(1);
	});

	test('refuses a migration that leaves an orphan row, and records nothing', () => {
		dir = mkdtempSync(join(tmpdir(), 'planner-db-'));
		const { client } = openDatabase(join(dir, 'orphan.db'));
		runMigrations(client, 'drizzle');

		const migrationsFolder = join(dir, 'migrations');
		const migrationName = '20990303000000_orphan';
		mkdirSync(join(migrationsFolder, migrationName), { recursive: true });
		writeFileSync(
			join(migrationsFolder, migrationName, 'migration.sql'),
			"INSERT INTO topic (id, name, course_id) VALUES ('t1', 'Forces', 'no-such-course');"
		);

		expect(() => runMigrations(client, migrationsFolder)).toThrow(
			new RegExp(`Migration "${migrationName}" failed`)
		);

		const count = (table: string) =>
			(client.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
		expect(count('topic')).toBe(0);
		expect(
			client
				.prepare('SELECT count(*) AS n FROM __drizzle_migrations WHERE name = ?')
				.get(migrationName)
		).toEqual({ n: 0 });
		expect(client.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 });
	});
});

describe('inTransaction', () => {
	test('rethrows the cause when SQLite has already ended the transaction', () => {
		dir = mkdtempSync(join(tmpdir(), 'planner-db-'));
		const { client } = openDatabase(join(dir, 'ended.db'));
		runMigrations(client, 'drizzle');

		expect(() =>
			inTransaction(client, () => {
				// What SQLite does on a full disk: the transaction is gone before the work throws,
				// so a second ROLLBACK would bury the real error under "no transaction is active".
				client.run('ROLLBACK');
				throw new Error('the disk is full');
			})
		).toThrow('the disk is full');
	});
});
