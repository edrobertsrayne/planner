import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { openDatabase, runMigrations } from '../db';
import * as schema from '../db/schema';
import { attachmentsDir } from '../planner';
import { createBackup } from './backup';
import { RestoreRefused, restoreBackup, type LiveDatabase } from './restore';

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function instance() {
	const dir = mkdtempSync(join(tmpdir(), 'planner-backup-'));
	dirs.push(dir);
	const databaseUrl = join(dir, 'planner.db');
	const opened = openDatabase(databaseUrl);
	runMigrations(opened.client, 'drizzle');
	return { dir, databaseUrl, ...opened };
}

// Two Attachments, one of them larger than a tar read chunk, so a boundary bug shows.
function populate(source: ReturnType<typeof instance>) {
	const [course] = source.db.insert(schema.course).values({ name: 'Physics' }).returning().all();
	const [topic] = source.db
		.insert(schema.topic)
		.values({ name: 'Forces', courseId: course.id })
		.returning()
		.all();
	const [lesson] = source.db
		.insert(schema.lesson)
		.values({ title: 'Intro', topicId: topic.id, position: 0 })
		.returning()
		.all();

	const files = [new Uint8Array(200_000).map((_, i) => i % 251), new TextEncoder().encode('hi')];
	mkdirSync(attachmentsDir(source.databaseUrl), { recursive: true });
	return files.map((bytes, position) => {
		const [row] = source.db
			.insert(schema.attachment)
			.values({
				lessonId: lesson.id,
				filename: `f${position}.txt`,
				mimeType: 'text/plain',
				size: bytes.length,
				position
			})
			.returning()
			.all();
		writeFileSync(join(attachmentsDir(source.databaseUrl), row.id), bytes);
		return { id: row.id, bytes };
	});
}

async function collect(body: ReadableStream<Uint8Array>) {
	return new Uint8Array(await new Response(body).arrayBuffer());
}

function streamOf(bytes: Uint8Array) {
	return new Response(bytes as Uint8Array<ArrayBuffer>).body!;
}

function restoreInto(target: ReturnType<typeof instance>, archive: Uint8Array) {
	let current = target;
	const live: LiveDatabase = {
		client: target.client,
		close: () => current.client.close(),
		reopen: () => {
			const reopened = openDatabase(target.databaseUrl);
			runMigrations(reopened.client, 'drizzle');
			current = { ...target, ...reopened };
		}
	};
	const done = restoreBackup({
		body: streamOf(archive),
		contentLength: archive.length,
		databaseUrl: target.databaseUrl,
		live,
		migrationsFolder: 'drizzle'
	});
	return { done, reopened: () => current };
}

const scratch = (target: ReturnType<typeof instance>) =>
	readdirSync(target.dir).filter((name) => name.startsWith('.'));

describe('Back up then Restore', () => {
	test('an empty instance gets every record and every Attachment byte', async () => {
		const source = instance();
		const attachments = populate(source);
		const backup = createBackup(source.client, source.databaseUrl);
		const archive = await collect(backup.body);
		expect(archive.length).toBe(backup.size);

		const target = instance();
		const restore = restoreInto(target, archive);
		await restore.done;

		const restored = restore.reopened();
		expect(
			restored.db
				.select()
				.from(schema.course)
				.all()
				.map((c) => c.name)
		).toEqual(['Physics']);
		for (const { id, bytes } of attachments) {
			const path = join(attachmentsDir(target.databaseUrl), id);
			expect(new Uint8Array(readFileSync(path))).toEqual(bytes);
		}
		expect(scratch(target)).toEqual([]);
	});

	test('an Attachment added after the copy is taken is left out', async () => {
		const source = instance();
		populate(source);
		const backup = createBackup(source.client, source.databaseUrl);
		writeFileSync(join(attachmentsDir(source.databaseUrl), 'late'), 'late');
		const archive = await collect(backup.body);

		expect(new TextDecoder('latin1').decode(archive)).not.toContain('attachments/late');
	});

	test('cancelling the download leaves no copy of the database behind', async () => {
		const source = instance();
		populate(source);
		const backup = createBackup(source.client, source.databaseUrl);
		await backup.body.cancel();

		expect(scratch(source)).toEqual([]);
	});
});

describe('Restore refuses before it writes anything', () => {
	async function refused(archive: (good: Uint8Array) => Uint8Array, message: RegExp) {
		const source = instance();
		populate(source);
		const good = await collect(createBackup(source.client, source.databaseUrl).body);

		const target = instance();
		const restore = restoreInto(target, archive(good));
		await expect(restore.done).rejects.toThrow(RestoreRefused);
		await expect(restore.done).rejects.toThrow(message);

		expect(target.db.select().from(schema.course).all()).toEqual([]);
		expect(scratch(target)).toEqual([]);
	}

	test('a truncated Backup', async () => {
		await refused((good) => good.slice(0, good.length - 1000), /damaged/);
	});

	test('a file that is not a Backup', async () => {
		await refused(() => new TextEncoder().encode('just some text'.repeat(100)), /not a Backup/);
	});

	test('a Backup from a newer version', async () => {
		const source = instance();
		populate(source);
		source.client.run(
			"INSERT INTO __drizzle_migrations (hash, created_at, name) VALUES ('x', 1, '99999999999999_from_the_future')"
		);
		const archive = await collect(createBackup(source.client, source.databaseUrl).body);

		const target = instance();
		const restore = restoreInto(target, archive);
		await expect(restore.done).rejects.toThrow(/newer version/);
		expect(target.db.select().from(schema.course).all()).toEqual([]);
		expect(scratch(target)).toEqual([]);
	});

	test('an Attachment whose file is not the size its row records', async () => {
		const source = instance();
		const [first] = populate(source);
		source.client.run('UPDATE attachment SET size = size + 1 WHERE id = ?', [first.id]);
		const archive = await collect(createBackup(source.client, source.databaseUrl).body);

		const target = instance();
		await expect(restoreInto(target, archive).done).rejects.toThrow(RestoreRefused);
		expect(scratch(target)).toEqual([]);
	});

	test('an instance that already holds planner data', async () => {
		const source = instance();
		populate(source);
		const archive = await collect(createBackup(source.client, source.databaseUrl).body);

		const target = instance();
		target.db.insert(schema.course).values({ name: 'Mine' }).run();
		await expect(restoreInto(target, archive).done).rejects.toThrow(/already holds data/);
		expect(target.db.select().from(schema.course).all()).toHaveLength(1);
	});

	test('an instance that already has a user', async () => {
		const source = instance();
		populate(source);
		const archive = await collect(createBackup(source.client, source.databaseUrl).body);

		const target = instance();
		target.client.run("INSERT INTO user (id, name, email) VALUES ('u1', 'Ed', 'ed@example.com')");
		await expect(restoreInto(target, archive).done).rejects.toThrow(/already has an account/);
		expect(target.db.select().from(schema.course).all()).toEqual([]);
		expect(scratch(target)).toEqual([]);
	});
});
