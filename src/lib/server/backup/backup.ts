// Back up (ADR-0024): a consistent copy of the database plus each Attachment file the copy names,
// streamed as one tar archive. Restore reads it back.
import { Database } from 'bun:sqlite';
import { closeSync, openSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { attachmentsDir } from '../planner';
import { sizeOfFd, tarChunks, tarLength } from './tar';

export const DATABASE_ENTRY = 'planner.db';
export const ATTACHMENT_PREFIX = 'attachments/';

/** What the Settings screen shows before the click: the live database plus every Attachment. The
 * copy is never larger than the live file, so this is an upper bound. */
export function expectedBackupSize(client: Database): number {
	const pages = client.query<{ bytes: number }, []>(
		'SELECT page_count * page_size AS bytes FROM pragma_page_count(), pragma_page_size()'
	);
	const files = client.query<{ bytes: number }, []>(
		// Each tar entry adds a 512-byte header and up to 511 bytes of padding.
		'SELECT COALESCE(SUM(size) + 1024 * COUNT(*), 0) AS bytes FROM attachment'
	);
	return pages.get()!.bytes + files.get()!.bytes;
}

/**
 * Starts a Backup. `VACUUM INTO` takes the copy while the server runs; the Attachments are the ids
 * that copy names, so one added during the download is left out. The copy is unlinked as soon as
 * it is open, so it cannot outlive the download however that ends.
 */
export function createBackup(
	client: Database,
	databaseUrl: string
): { size: number; body: ReadableStream<Uint8Array> } {
	const copyPath = join(dirname(databaseUrl), `.backup-${crypto.randomUUID()}.db`);
	client.run(`VACUUM INTO '${copyPath.replaceAll("'", "''")}'`);

	let copyFd: number;
	let ids: string[];
	try {
		copyFd = openSync(copyPath, 'r');
		const copy = new Database(copyPath, { readonly: true });
		try {
			ids = copy
				.query<{ id: string }, []>('SELECT id FROM attachment ORDER BY position')
				.all()
				.map((row) => row.id);
		} finally {
			copy.close();
		}
	} finally {
		unlinkSync(copyPath);
	}

	const directory = attachmentsDir(databaseUrl);
	const files: { name: string; size: number; fd: number }[] = [
		{ name: DATABASE_ENTRY, size: sizeOfFd(copyFd), fd: copyFd }
	];
	try {
		for (const id of ids) {
			// Opened here, not when the stream reaches it: an open fd outlives the file being
			// deleted, so a teacher removing an Attachment mid-download cannot truncate the archive.
			const fd = openSync(join(directory, id), 'r');
			files.push({ name: `${ATTACHMENT_PREFIX}${id}`, size: sizeOfFd(fd), fd });
		}
	} catch (cause) {
		for (const file of files) closeSync(file.fd);
		throw cause;
	}

	const chunks = tarChunks(files);
	let closed = false;
	const closeFiles = () => {
		if (closed) return;
		closed = true;
		for (const file of files) closeSync(file.fd);
	};
	return {
		size: tarLength(files.map((file) => file.size)),
		body: new ReadableStream<Uint8Array>({
			async pull(controller) {
				let step: IteratorResult<Uint8Array>;
				try {
					step = await chunks.next();
				} catch (cause) {
					closeFiles();
					throw cause;
				}
				const { done, value } = step;
				if (done) {
					closeFiles();
					controller.close();
				} else controller.enqueue(value);
			},
			async cancel() {
				closeFiles();
				await chunks.return(undefined);
			}
		})
	};
}
