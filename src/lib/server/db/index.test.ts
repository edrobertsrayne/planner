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

// The plan tables of the databases the old-database tests build by hand: the Sequence migration
// empties them, so they must exist.
const oldPlanTables = `
	CREATE TABLE assigned_topic (id text PRIMARY KEY);
	CREATE TABLE session (id text PRIMARY KEY, note text);
	CREATE TABLE continuation (id text PRIMARY KEY);
`;

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

test('the tone backfill walks existing Classes in creation order and wraps past eight', () => {
	dir = mkdtempSync(join(tmpdir(), 'planner-db-'));
	const { client } = openDatabase(join(dir, 'backfill.db'));

	// The database as it stood before the tone column existed (ADR-0013), with the migrations
	// of that day already marked applied — so only the tone migration is pending.
	client.exec(`CREATE TABLE __drizzle_migrations (
		id INTEGER PRIMARY KEY,
		hash TEXT NOT NULL,
		created_at NUMERIC,
		name TEXT,
		applied_at TEXT
	)`);
	for (const earlier of ['20260814131415_pink_omega_red', '20260814200509_friendly_quicksilver'])
		client.prepare('INSERT INTO __drizzle_migrations (hash, name) VALUES (?, ?)').run('x', earlier);

	client.exec(`
		CREATE TABLE course (id text PRIMARY KEY, name text NOT NULL);
		CREATE TABLE topic (id text PRIMARY KEY, name text NOT NULL, course_id text NOT NULL);
		CREATE TABLE class (
			id text PRIMARY KEY,
			label text NOT NULL,
			course_id text NOT NULL,
			CONSTRAINT fk_class_course_id_course_id_fk FOREIGN KEY (course_id) REFERENCES course(id)
		);
		CREATE TABLE lesson (
			id text PRIMARY KEY,
			topic_id text,
			title text NOT NULL,
			body text,
			planned_length integer DEFAULT 1 NOT NULL,
			position integer NOT NULL
		);
		CREATE TABLE term (
			id text PRIMARY KEY,
			name text NOT NULL,
			opens text NOT NULL,
			closes text NOT NULL
		);
		CREATE TABLE slot (id text PRIMARY KEY);
		${oldPlanTables}
		CREATE TABLE teaching_week (
			id text PRIMARY KEY,
			week_commencing text NOT NULL,
			letter text NOT NULL
		);
	`);
	client.prepare("INSERT INTO course (id, name) VALUES ('c1', 'Science')").run();
	client.prepare("INSERT INTO topic (id, name, course_id) VALUES ('t1', 'Forces', 'c1')").run();

	const insertClass = client.prepare(
		"INSERT INTO class (id, label, course_id) VALUES (?, ?, 'c1')"
	);
	for (let i = 1; i <= 10; i++) insertClass.run(`cls-${i}`, `9A/Ma${i}`);

	runMigrations(client, 'drizzle');

	// Creation order is rowid order; the walk hands out 0, 4, 6, 7, 1, 2, 5, 3, then wraps.
	const tones = client
		.prepare('SELECT label, tone FROM class ORDER BY rowid')
		.all()
		.map((row) => (row as { label: string; tone: number }).tone);
	expect(tones).toEqual([0, 4, 6, 7, 1, 2, 5, 3, 0, 4]);
});

test('the Course tone backfill walks existing Courses in creation order, apart from Classes', () => {
	dir = mkdtempSync(join(tmpdir(), 'planner-db-'));
	const { client } = openDatabase(join(dir, 'course-tone.db'));

	client.exec(`CREATE TABLE __drizzle_migrations (
		id INTEGER PRIMARY KEY,
		hash TEXT NOT NULL,
		created_at NUMERIC,
		name TEXT,
		applied_at TEXT
	)`);
	for (const earlier of ['20260814131415_pink_omega_red', '20260814200509_friendly_quicksilver'])
		client.prepare('INSERT INTO __drizzle_migrations (hash, name) VALUES (?, ?)').run('x', earlier);

	client.exec(`
		CREATE TABLE course (id text PRIMARY KEY, name text NOT NULL);
		CREATE TABLE topic (id text PRIMARY KEY, name text NOT NULL, course_id text NOT NULL);
		CREATE TABLE class (
			id text PRIMARY KEY,
			label text NOT NULL,
			course_id text NOT NULL
		);
		CREATE TABLE lesson (
			id text PRIMARY KEY,
			topic_id text,
			title text NOT NULL,
			body text,
			planned_length integer DEFAULT 1 NOT NULL,
			position integer NOT NULL
		);
		CREATE TABLE term (
			id text PRIMARY KEY,
			name text NOT NULL,
			opens text NOT NULL,
			closes text NOT NULL
		);
		CREATE TABLE slot (id text PRIMARY KEY);
		${oldPlanTables}
		CREATE TABLE teaching_week (
			id text PRIMARY KEY,
			week_commencing text NOT NULL,
			letter text NOT NULL
		);
	`);
	const insertCourse = client.prepare('INSERT INTO course (id, name) VALUES (?, ?)');
	// Ids sort against creation order, so only rowid order can give the right answer.
	for (let i = 10; i >= 1; i--) insertCourse.run(`c-${String.fromCharCode(96 + i)}`, `Course ${i}`);
	client.prepare("INSERT INTO class (id, label, course_id) VALUES ('k1', '9A', 'c-j')").run();

	runMigrations(client, 'drizzle');

	const tones = client
		.prepare('SELECT tone FROM course ORDER BY rowid')
		.all()
		.map((row) => (row as { tone: number }).tone);
	expect(tones).toEqual([0, 4, 6, 7, 1, 2, 5, 3, 0, 4]);
});

test('the lesson status migration writes draft as default for existing lessons and enforces check constraint', () => {
	dir = mkdtempSync(join(tmpdir(), 'planner-db-'));
	const { client } = openDatabase(join(dir, 'status-migration.db'));

	client.exec(`CREATE TABLE __drizzle_migrations (
		id INTEGER PRIMARY KEY,
		hash TEXT NOT NULL,
		created_at NUMERIC,
		name TEXT,
		applied_at TEXT
	)`);
	for (const earlier of [
		'20260814131415_pink_omega_red',
		'20260814200509_friendly_quicksilver',
		'20260823000000_class_tone',
		'20260825000000_lesson_length'
	]) {
		client.prepare('INSERT INTO __drizzle_migrations (hash, name) VALUES (?, ?)').run('x', earlier);
	}

	client.exec(`
		CREATE TABLE course (id text PRIMARY KEY, name text NOT NULL);
		CREATE TABLE topic (id text PRIMARY KEY, name text NOT NULL, course_id text NOT NULL);
		CREATE TABLE lesson (
			id text PRIMARY KEY,
			topic_id text NOT NULL,
			title text NOT NULL,
			body text,
			length integer DEFAULT 1 NOT NULL,
			position integer NOT NULL
		);
		CREATE TABLE term (
			id text PRIMARY KEY,
			name text NOT NULL,
			opens text NOT NULL,
			closes text NOT NULL
		);
		CREATE TABLE slot (id text PRIMARY KEY);
		CREATE TABLE class (id text PRIMARY KEY);
		${oldPlanTables}
		CREATE TABLE teaching_week (
			id text PRIMARY KEY,
			week_commencing text NOT NULL,
			letter text NOT NULL
		);
	`);
	client.prepare("INSERT INTO course (id, name) VALUES ('c1', 'Physics')").run();
	client.prepare("INSERT INTO topic (id, name, course_id) VALUES ('t1', 'Forces', 'c1')").run();
	client
		.prepare("INSERT INTO lesson (id, topic_id, title, position) VALUES ('l1', 't1', 'Speed', 1)")
		.run();

	runMigrations(client, 'drizzle');

	const row = client.prepare('SELECT status FROM lesson WHERE id = ?').get('l1') as {
		status: string;
	};
	expect(row.status).toBe('draft');

	expect(() => {
		client
			.prepare(
				"INSERT INTO lesson (id, topic_id, title, position, status) VALUES ('l2', 't1', 'Velocity', 2, 'invalid')"
			)
			.run();
	}).toThrow(/CHECK constraint failed/i);
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
