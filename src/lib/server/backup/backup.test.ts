import type { Database } from 'bun:sqlite';
import {
	chmodSync,
	closeSync,
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	openSync,
	readdirSync,
	readFileSync,
	rmSync,
	unlinkSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { openDatabase, runMigrations } from '../db';
import * as schema from '../db/schema';
import { attachmentsDir } from '../planner';
import { ATTACHMENT_PREFIX, DATABASE_ENTRY, createBackup } from './backup';
import { RestoreRefused, restoreBackup, type LiveDatabase } from './restore';
import { sizeOfFd, tarChunks } from './tar';

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function instance(migrationsFolder = 'drizzle') {
	const dir = mkdtempSync(join(tmpdir(), 'planner-backup-'));
	dirs.push(dir);
	const databaseUrl = join(dir, 'planner.db');
	const opened = openDatabase(databaseUrl);
	runMigrations(opened.client, migrationsFolder);
	return { dir, databaseUrl, ...opened };
}

/** The migrations folder as an earlier version of the planner shipped it: everything but the last
 * migration, so a Backup made with it is one that has to be upgraded. */
function olderMigrations(): string {
	const dir = mkdtempSync(join(tmpdir(), 'planner-migrations-'));
	dirs.push(dir);
	const names = readdirSync('drizzle').sort();
	const last = names[names.length - 1];
	for (const name of names) {
		if (name !== last) cpSync(join('drizzle', name), join(dir, name), { recursive: true });
	}
	return dir;
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

/** An archive built from files on disk, so a test can add an entry `createBackup` never writes. */
async function archiveOf(files: { name: string; path: string }[]) {
	const entries = files.map((file) => {
		const fd = openSync(file.path, 'r');
		return { name: file.name, size: sizeOfFd(fd), fd };
	});
	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			for await (const chunk of tarChunks(entries)) controller.enqueue(chunk);
			controller.close();
		}
	});
	try {
		return await collect(stream);
	} finally {
		for (const entry of entries) closeSync(entry.fd);
	}
}

function streamOf(bytes: Uint8Array) {
	return new Response(bytes as Uint8Array<ArrayBuffer>).body!;
}

function restoreInto(
	target: ReturnType<typeof instance>,
	archive: Uint8Array,
	body: ReadableStream<Uint8Array> = streamOf(archive)
) {
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
		body,
		contentLength: archive.length,
		databaseUrl: target.databaseUrl,
		live,
		migrationsFolder: 'drizzle'
	});
	return { done, reopened: () => current };
}

const scratch = (target: ReturnType<typeof instance>) =>
	readdirSync(target.dir).filter((name) => name.startsWith('.'));

const schemaOf = (client: Database) =>
	client
		.query<{ name: string; sql: string }, []>(
			"SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name"
		)
		.all();

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

	test('an Attachment deleted while the Backup streams is still in the archive', async () => {
		const source = instance();
		const attachments = populate(source);
		const last = attachments[1];
		const backup = createBackup(source.client, source.databaseUrl);

		// Take one chunk, then delete the Attachment the stream has not reached yet: the fd Back up
		// took at the start is what keeps its bytes.
		const reader = backup.body.getReader();
		const chunks: Uint8Array[] = [];
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
			if (chunks.length === 1) unlinkSync(join(attachmentsDir(source.databaseUrl), last.id));
		}
		const archive = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
		let offset = 0;
		for (const chunk of chunks) {
			archive.set(chunk, offset);
			offset += chunk.length;
		}
		expect(archive.length).toBe(backup.size);

		const target = instance();
		const restore = restoreInto(target, archive);
		await restore.done;
		for (const { id, bytes } of attachments) {
			expect(new Uint8Array(readFileSync(join(attachmentsDir(target.databaseUrl), id)))).toEqual(
				bytes
			);
		}
	});

	test('an older Backup is upgraded to the current schema by the full migrations folder', async () => {
		const source = instance(olderMigrations());
		const [course] = source.db.insert(schema.course).values({ name: 'Physics' }).returning().all();
		const [topic] = source.db
			.insert(schema.topic)
			.values({ name: 'Forces', courseId: course.id })
			.returning()
			.all();
		source.db
			.insert(schema.lesson)
			.values({ title: 'Intro', topicId: topic.id, position: 0 })
			.run();

		const archive = await collect(createBackup(source.client, source.databaseUrl).body);
		const target = instance();
		const restore = restoreInto(target, archive);
		await restore.done;

		const restored = restore.reopened();
		expect(
			restored.db
				.select()
				.from(schema.course)
				.all()
				.map((row) => row.name)
		).toEqual(['Physics']);
		expect(
			restored.db
				.select()
				.from(schema.lesson)
				.all()
				.map((row) => row.title)
		).toEqual(['Intro']);
		expect(schemaOf(restored.client)).toEqual(schemaOf(instance().client));
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

	test('a staged file that no Attachment row names', async () => {
		const source = instance();
		const copy = join(source.dir, 'copy.db');
		source.client.run(`VACUUM INTO '${copy}'`);
		const stray = join(source.dir, 'stray');
		writeFileSync(stray, 'no row names this');
		const archive = await archiveOf([
			{ name: DATABASE_ENTRY, path: copy },
			{ name: `${ATTACHMENT_PREFIX}stray`, path: stray }
		]);

		const target = instance();
		await expect(restoreInto(target, archive).done).rejects.toThrow(RestoreRefused);
		expect(target.db.select().from(schema.course).all()).toEqual([]);
		expect(scratch(target)).toEqual([]);
	});

	test('a Backup whose rows point at records it does not contain', async () => {
		const source = instance();
		populate(source);
		// A copy taken while the database held an orphan. Restore has to refuse it, or the broken
		// reference moves into the fresh instance and every later write on that row fails.
		source.client.run('PRAGMA foreign_keys = OFF');
		source.client.run("UPDATE attachment SET lesson_id = 'missing'");
		const archive = await collect(createBackup(source.client, source.databaseUrl).body);

		const target = instance();
		await expect(restoreInto(target, archive).done).rejects.toThrow(/inconsistent/);
		expect(target.db.select().from(schema.course).all()).toEqual([]);
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

	test('the upload is unpacked straight from the request, with no second copy on disk', async () => {
		const source = instance();
		populate(source);
		const archive = await collect(createBackup(source.client, source.databaseUrl).body);

		const target = instance();
		const seen = new Set<string>();
		const reader = streamOf(archive).getReader();
		const body = new ReadableStream<Uint8Array>({
			async pull(controller) {
				// What the scratch folder holds while the restore is still reading the upload.
				for (const dir of scratch(target)) {
					for (const name of readdirSync(join(target.dir, dir))) seen.add(name);
				}
				const { done, value } = await reader.read();
				if (done) controller.close();
				else controller.enqueue(value);
			}
		});

		await restoreInto(target, archive, body).done;

		expect(seen).not.toContain('upload.tar');
		expect(seen).toContain(DATABASE_ENTRY);
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

describe('A Restore that fails at the swap', () => {
	test('leaves the instance empty with the database reopened', async () => {
		const source = instance();
		populate(source);
		const archive = await collect(createBackup(source.client, source.databaseUrl).body);

		const target = instance();
		// Live storage the swap cannot empty: a directory whose contents cannot be removed without
		// write permission on it, as a deployment running under another user can leave behind.
		const locked = join(attachmentsDir(target.databaseUrl), 'locked');
		mkdirSync(locked, { recursive: true });
		writeFileSync(join(locked, 'keep'), 'x');
		chmodSync(locked, 0o500);

		const restore = restoreInto(target, archive);
		try {
			const failure = await restore.done.catch((cause: unknown) => cause);
			// The Restore got past every check and died in the swap, at the point it tried to empty
			// live storage, before the database file was replaced.
			expect(failure).toBeInstanceOf(Error);
			expect(failure).not.toBeInstanceOf(RestoreRefused);
			expect(readdirSync(attachmentsDir(target.databaseUrl))).toContain('locked');
			// A reopened connection, on the migrated schema, with no planner data: the wizard is
			// still open.
			expect(restore.reopened().db.select().from(schema.course).all()).toEqual([]);
			expect(scratch(target)).toEqual([]);
		} finally {
			chmodSync(locked, 0o700);
		}
	});

	test('a swap that fails after moving the Attachments removes them again', async () => {
		const source = instance();
		populate(source);
		const archive = await collect(createBackup(source.client, source.databaseUrl).body);

		const target = instance();
		let current = target;
		const live: LiveDatabase = {
			client: target.client,
			close: () => {
				current.client.close();
				for (const suffix of ['', '-wal', '-shm'])
					rmSync(target.databaseUrl + suffix, { force: true });
				// The name the database has to be renamed onto is a directory, so the swap fails
				// after the Attachments have already moved.
				mkdirSync(target.databaseUrl);
			},
			reopen: () => {
				rmSync(target.databaseUrl, { recursive: true, force: true });
				const reopened = openDatabase(target.databaseUrl);
				runMigrations(reopened.client, 'drizzle');
				current = { ...target, ...reopened };
			}
		};

		const failure = await restoreBackup({
			body: streamOf(archive),
			contentLength: archive.length,
			databaseUrl: target.databaseUrl,
			live,
			migrationsFolder: 'drizzle'
		}).catch((cause: unknown) => cause);

		expect(failure).toBeInstanceOf(Error);
		expect(failure).not.toBeInstanceOf(RestoreRefused);
		// The Attachments moved for a Restore that did not land; they are not left beside the empty
		// database.
		expect(existsSync(attachmentsDir(target.databaseUrl))).toBe(false);
		expect(scratch(target)).toEqual([]);
		expect(current.db.select().from(schema.course).all()).toEqual([]);
	});
});
