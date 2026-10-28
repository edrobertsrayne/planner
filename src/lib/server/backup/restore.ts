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
import { inTransaction, runMigrations } from '../db';
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

export async function restoreBackup(options: {
	body: ReadableStream<Uint8Array>;
	contentLength: number | null;
	databaseUrl: string;
	client: Database;
	migrationsFolder?: string;
}): Promise<void> {
	const { databaseUrl, client } = options;
	const dataDir = dirname(databaseUrl);

	if (!options.contentLength) throw new RestoreRefused('The upload did not say how large it is.');
	const { bavail, bsize } = statfsSync(dataDir);
	// The unpacked Backup and the live database it is copied into exist together, so the scratch
	// folder and the live file each need room for the Backup's contents.
	if (bavail * bsize < 2 * options.contentLength) {
		throw new RestoreRefused(
			'There is not enough free disk space to restore this Backup. Restore needs about twice its size.'
		);
	}

	const work = join(dataDir, `.restore-${crypto.randomUUID()}`);
	const stagedDatabase = join(work, DATABASE_ENTRY);
	const stagedAttachments = join(work, 'attachments');
	mkdirSync(stagedAttachments, { recursive: true });

	try {
		await unpack(options.body, stagedDatabase, stagedAttachments);

		checkStaged(stagedDatabase, stagedAttachments, options.migrationsFolder ?? 'drizzle');

		if (hasPlannerData(client)) {
			throw new RestoreRefused('This planner already holds data, so it cannot be restored over.');
		}

		apply(client, databaseUrl, stagedDatabase, stagedAttachments);
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

// The migrations table describes the schema, not the data, and the live database is already on the
// same migrations as the upgraded staged copy. Leaving it alone means the copy never rewrites the
// schema version it was checked against.
const NOT_COPIED = new Set(['__drizzle_migrations']);

/** The tables a Restore copies, in a stable order, from one attached database. */
function copiedTables(client: Database, database: 'main' | 'staged'): string[] {
	return client
		.query<{ name: string }, []>(
			`SELECT name FROM ${database}.sqlite_master
			 WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
		)
		.all()
		.map((row) => row.name)
		.filter((name) => !NOT_COPIED.has(name))
		.sort();
}

/** The only step that writes the live instance. The staged database is attached and its rows are
 * copied into the live tables in one transaction, so the database part of a Restore either lands
 * whole or not at all, and the live connection never closes. Attachments move inside that
 * transaction; if it does not commit, the moved files are removed again.
 *
 * The caller serialises this with first-run sign-up (`firstRun`), so nothing can create a user
 * between the check and the copy. */
function apply(
	client: Database,
	databaseUrl: string,
	stagedDatabase: string,
	stagedAttachments: string
) {
	if (client.query('SELECT 1 FROM "user" LIMIT 1').get() !== null) {
		throw new RestoreRefused('This planner already has an account.');
	}

	client.run('ATTACH DATABASE ? AS staged', [stagedDatabase]);
	try {
		const live = copiedTables(client, 'main');
		const staged = copiedTables(client, 'staged');
		// The staged copy was upgraded to this version's migrations. A different set of tables is not
		// a Backup this version knows how to take apart.
		if (live.join('\n') !== staged.join('\n')) throw new RestoreRefused(NOT_A_BACKUP);

		const liveAttachments = attachmentsDir(databaseUrl);
		let attachmentsMoved = false;
		const journalMode = client.query<{ journal_mode: string }, []>('PRAGMA journal_mode').get()!
			.journal_mode;

		// Foreign keys stay off while every table is emptied and refilled. With them on, a child row
		// inserted from another database before its parent is refused at COMMIT even when the parent
		// arrives in the same transaction — defer_foreign_keys does not save it under Bun's SQLite —
		// and one fixed table order cannot put every foreign key first. The staged copy was checked
		// for orphans, and the copy is checked again before it commits.
		client.run('PRAGMA foreign_keys = OFF');
		try {
			// Writing the whole database into a WAL would keep a second copy of it on disk until a
			// checkpoint. The rollback journal holds only the pages being replaced, and the file is
			// switched back when the copy is done.
			client.run('PRAGMA journal_mode = DELETE');
			inTransaction(client, () => {
				for (const table of live) client.run(`DELETE FROM main."${table}"`);
				for (const table of live) {
					client.run(`INSERT INTO main."${table}" SELECT * FROM staged."${table}"`);
				}
				if (client.query('PRAGMA foreign_key_check').get() !== null) {
					throw new RestoreRefused(ORPHAN_ROWS);
				}
				rmSync(liveAttachments, { recursive: true, force: true });
				renameSync(stagedAttachments, liveAttachments);
				attachmentsMoved = true;
			});
		} catch (cause) {
			// The transaction rolled back; the files that moved beside it belong to a Restore that
			// did not land.
			if (attachmentsMoved) rmSync(liveAttachments, { recursive: true, force: true });
			throw cause;
		} finally {
			try {
				client.run(`PRAGMA journal_mode = ${journalMode}`);
			} finally {
				client.run('PRAGMA foreign_keys = ON');
			}
		}
	} finally {
		client.run('DETACH DATABASE staged');
	}
}
