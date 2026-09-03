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
		'tag',
		'lesson_tag',
		'attachment',
		'class',
		'assigned_topic',
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
