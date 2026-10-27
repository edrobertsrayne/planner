// Restore (ADR-0024): rebuild an empty instance from a Backup, all-or-nothing. Everything is
// unpacked and checked in a scratch folder beside the database; the live files are touched only in
// the final swap, after every check has passed.
import { Database } from 'bun:sqlite';
import {
	closeSync,
	mkdirSync,
	openSync,
	readdirSync,
	renameSync,
	rmSync,
	statfsSync,
	statSync,
	writeSync
} from 'node:fs';
import { dirname, join } from 'node:path';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { runMigrations } from '../db';
import { attachmentsDir } from '../planner';
import { ATTACHMENT_PREFIX, DATABASE_ENTRY } from './backup';
import { BadArchive, untar } from './tar';

/** A refusal written for the person at the wizard to read. */
export class RestoreRefused extends Error {}

const NEWER_VERSION =
	'This Backup comes from a newer version of the planner. Update this instance first.';
const NOT_A_BACKUP =
	'This file is not a Backup, or it is damaged. Choose a file that Back up made.';
const ORPHAN_ROWS =
	'This Backup is inconsistent: some of its rows point at records it does not contain.';

// The tables that hold the login rather than planner data. An instance whose only rows are these
// is empty for Restore's purpose (`reset-credentials` deletes the user and leaves the planner).
const NOT_PLANNER_DATA = new Set([
	'__drizzle_migrations',
	'user',
	'account',
	'auth_session',
	'verification',
	'api_key'
]);

const ATTACHMENT_ID = /^[\w-]+$/;

export type LiveDatabase = {
	/** The live client, to check that the instance holds no planner data. */
	client: Database;
	/** Releases the live database file so that it can be replaced. */
	close(): void;
	/** Opens whatever is at the database path now, migrating it. Called even after a failed swap. */
	reopen(): void;
};

export async function restoreBackup(options: {
	body: ReadableStream<Uint8Array>;
	contentLength: number | null;
	databaseUrl: string;
	live: LiveDatabase;
	migrationsFolder?: string;
}): Promise<void> {
	const { databaseUrl, live } = options;
	const dataDir = dirname(databaseUrl);

	if (!options.contentLength) throw new RestoreRefused('The upload did not say how large it is.');
	const { bavail, bsize } = statfsSync(dataDir);
	// The upload is unpacked file for file into the scratch folder, so the space it needs is about
	// its own size: there is no second copy of the archive on disk.
	if (bavail * bsize < options.contentLength) {
		throw new RestoreRefused(
			'There is not enough free disk space to restore this Backup. Restore needs about as much free space as the Backup is large.'
		);
	}

	const work = join(dataDir, `.restore-${crypto.randomUUID()}`);
	const stagedDatabase = join(work, DATABASE_ENTRY);
	const stagedAttachments = join(work, 'attachments');
	mkdirSync(stagedAttachments, { recursive: true });

	try {
		await unpack(options.body, stagedDatabase, stagedAttachments);

		checkStaged(stagedDatabase, stagedAttachments, options.migrationsFolder ?? 'drizzle');

		if (hasPlannerData(live.client)) {
			throw new RestoreRefused('This planner already holds data, so it cannot be restored over.');
		}

		swap(databaseUrl, stagedDatabase, stagedAttachments, live);
	} finally {
		rmSync(work, { recursive: true, force: true });
	}
}

async function unpack(
	body: ReadableStream<Uint8Array>,
	databasePath: string,
	attachmentsPath: string
) {
	const seen = new Set<string>();
	try {
		await untar(body, (name) => {
			let path: string;
			if (name === DATABASE_ENTRY) path = databasePath;
			else if (
				name.startsWith(ATTACHMENT_PREFIX) &&
				ATTACHMENT_ID.test(name.slice(ATTACHMENT_PREFIX.length))
			) {
				path = join(attachmentsPath, name.slice(ATTACHMENT_PREFIX.length));
			} else throw new BadArchive(`Unexpected entry ${name}.`);
			if (seen.has(name)) throw new BadArchive(`Repeated entry ${name}.`);
			seen.add(name);

			const fd = openSync(path, 'w');
			return { write: (chunk) => void writeSync(fd, chunk), close: () => closeSync(fd) };
		});
	} catch (cause) {
		if (cause instanceof BadArchive) throw new RestoreRefused(NOT_A_BACKUP);
		throw cause;
	}
	if (!seen.has(DATABASE_ENTRY)) throw new RestoreRefused(NOT_A_BACKUP);
}

/** Opens the unpacked database, refuses anything unreadable, newer or incomplete, and upgrades an
 * older one. Leaves a single self-contained file with no WAL beside it. */
function checkStaged(databasePath: string, attachmentsPath: string, migrationsFolder: string) {
	let staged: Database;
	try {
		staged = new Database(databasePath);
	} catch {
		throw new RestoreRefused(NOT_A_BACKUP);
	}

	try {
		let applied: string[];
		let attachments: { id: string; size: number }[];
		try {
			const [{ quick_check }] = staged
				.query<{ quick_check: string }, []>('PRAGMA quick_check')
				.all();
			if (quick_check !== 'ok') throw new Error(quick_check);
			applied = staged
				.query<{ name: string }, []>('SELECT name FROM __drizzle_migrations')
				.all()
				.map((row) => row.name);
			attachments = staged
				.query<{ id: string; size: number }, []>('SELECT id, size FROM attachment')
				.all();
		} catch {
			throw new RestoreRefused(NOT_A_BACKUP);
		}

		const known = new Set(readMigrationFiles({ migrationsFolder }).map((m) => m.name));
		if (applied.some((name) => !known.has(name))) throw new RestoreRefused(NEWER_VERSION);

		for (const { id, size } of attachments) {
			let found: number;
			try {
				if (!ATTACHMENT_ID.test(id)) throw new Error('not an id');
				found = statSync(join(attachmentsPath, id)).size;
			} catch {
				throw new RestoreRefused(NOT_A_BACKUP);
			}
			if (found !== size) throw new RestoreRefused(NOT_A_BACKUP);
		}

		// Unpack accepts any well-formed name, so a file that no row names would move into live
		// storage and stay there for ever.
		const named = new Set(attachments.map((row) => row.id));
		for (const name of readdirSync(attachmentsPath)) {
			if (!named.has(name)) throw new RestoreRefused(NOT_A_BACKUP);
		}

		// SQLite opens with foreign keys off, while startup migrates with them on, so an upgrade
		// here has to turn them on too or it cascades differently. A copy whose rows point at
		// records it does not hold is then refused rather than restored.
		staged.run('PRAGMA foreign_keys = ON');
		runMigrations(staged, migrationsFolder);
		if (staged.query('PRAGMA foreign_key_check').get() !== null) {
			throw new RestoreRefused(ORPHAN_ROWS);
		}
		staged.run('PRAGMA journal_mode = DELETE');
	} finally {
		staged.close();
	}
}

function hasPlannerData(client: Database): boolean {
	const tables = client
		.query<{ name: string }, []>(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
		)
		.all()
		.map((row) => row.name)
		.filter((name) => !NOT_PLANNER_DATA.has(name));

	return tables.some((name) => client.query(`SELECT 1 FROM "${name}" LIMIT 1`).get() !== null);
}

/** The only step that touches live files. It checks for a user and then moves the files in one
 * synchronous block, so a wizard sign-up cannot slip in between. The database is reopened whatever
 * happens: a failed swap leaves no database file, so the reopened one is empty and the wizard is
 * still open. */
function swap(
	databaseUrl: string,
	stagedDatabase: string,
	stagedAttachments: string,
	live: LiveDatabase
) {
	if (live.client.query('SELECT 1 FROM "user" LIMIT 1').get() !== null) {
		throw new RestoreRefused('This planner already has an account.');
	}
	live.close();
	const liveAttachments = attachmentsDir(databaseUrl);
	let attachmentsMoved = false;
	try {
		rmSync(liveAttachments, { recursive: true, force: true });
		renameSync(stagedAttachments, liveAttachments);
		attachmentsMoved = true;
		for (const suffix of ['', '-wal', '-shm']) rmSync(databaseUrl + suffix, { force: true });
		renameSync(stagedDatabase, databaseUrl);
	} catch (cause) {
		// The database is still the empty one the wizard had. The Attachments that moved beside it
		// belong to a Restore that did not land, so they go too: the instance stays empty.
		if (attachmentsMoved) rmSync(liveAttachments, { recursive: true, force: true });
		throw cause;
	} finally {
		live.reopen();
	}
}
