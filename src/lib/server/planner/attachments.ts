// Attachments — files a Lesson holds that the planner stores itself (spec #237). A Link points
// elsewhere; an Attachment's bytes live in a flat directory beside the database file, named by
// the row's own UUID with no extension, so a Detach or Topic move never moves a file.
//
// Everything file-shaped about an Attachment lives in this one module: the directory derivation,
// the allow-list, and the create — validate first, then write the file, then insert the row,
// undoing the file if the row fails, so a failed create leaves neither.
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { asc, eq } from 'drizzle-orm';
import type { Db } from './derive';
import { nextPosition } from './ordering';
import * as schema from '../db/schema';

// One flat ceiling for every type (spec #219), enforced here before anything is written.
const MAX_BYTES = 10 * 1024 * 1024;

// The allow-list (spec #219): each extension's standard type plus the generic type browsers
// actually report for it on platforms that never mapped the extension — an unregistered `.md`
// arrives as octet-stream or as nothing at all. PDF is the exception: every browser maps it, so
// it takes its one type only. No legacy Office formats, no OpenDocument, no images.
//
// The mismatch branch below cannot fire through the form action: Bun's form-data parser rewrites
// a file part's type from its filename extension before the action reads it, so a browser-declared
// disagreement never reaches this check. It stays because the check is the spec's grilled rule and
// a pure function — proven directly in attachments.test.ts — and any future caller of create
// passes through it.
const MIME_BY_EXTENSION: Record<string, readonly string[]> = {
	pdf: ['application/pdf'],
	md: ['text/markdown', 'text/plain', 'application/octet-stream'],
	txt: ['text/plain', 'application/octet-stream'],
	docx: [
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/octet-stream'
	],
	pptx: [
		'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		'application/octet-stream'
	],
	xlsx: [
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'application/octet-stream'
	]
};

// A refusal the create has already decided on — a type the allow-list refuses, or a file over
// the ceiling. Thrown with the message already written for Ed to read; the form action maps it
// to a 4xx with no further work, the way NameCollision does for names.
export class AttachmentRejected extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AttachmentRejected';
	}
}

// The flat attachments directory beside the database file (spec #217) — `/app/data/attachments`
// in deployment, derived rather than hardcoded, so development, the e2e scratch database and the
// unit fixtures each write beside their own database.
export function attachmentsDir(databaseUrl: string): string {
	return join(dirname(databaseUrl), 'attachments');
}

function rejectionReason(filename: string, mimeType: string, size: number): string | null {
	const dot = filename.lastIndexOf('.');
	const extension = dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
	// Own-property access: a filename like "notes.constructor" must fall through to the
	// refusal below, not inherit Object.prototype's keys.
	const allowed = Object.hasOwn(MIME_BY_EXTENSION, extension)
		? MIME_BY_EXTENSION[extension]
		: undefined;
	if (!allowed) {
		return `"${filename}" is not a supported file type — use PDF, Markdown, text, Word, PowerPoint or Excel.`;
	}
	if (!allowed.includes(mimeType)) {
		return `"${filename}" was reported as "${mimeType}", which does not match a .${extension} file.`;
	}
	if (size > MAX_BYTES) {
		return 'Attachments are limited to 10 MB.';
	}
	return null;
}

// A Lesson's Attachments in their own position order — independent of Link's, the sections are
// separate (spec #220).
export function attachmentsOf(db: Db, lessonId: string) {
	return db
		.select()
		.from(schema.attachment)
		.where(eq(schema.attachment.lessonId, lessonId))
		.orderBy(asc(schema.attachment.position))
		.all();
}

// The serving route's one lookup (spec #221): a parameterized query resolved before any path is
// built, so a miss — including a traversal payload that matches no row — 404s before the
// on-disk path, which is derived only from the row's own id, ever exists.
export function attachmentById(db: Db, id: string) {
	const [row] = db.select().from(schema.attachment).where(eq(schema.attachment.id, id)).all();
	return row;
}

// A direct delete (mirrors deleteLink's shape) plus the unlink (spec #222). The row goes first —
// unlike create, where a row must never exist without its file, a delete's file is a trailing
// cleanup of something no longer referenced. A missing file at this point is swallowed: ENOENT
// is already the desired end state, not a failure to report.
export function deleteAttachment(db: Db, id: string, dir: string) {
	const [row] = db.delete(schema.attachment).where(eq(schema.attachment.id, id)).returning().all();
	if (!row) return undefined;
	try {
		unlinkSync(join(dir, row.id));
	} catch {
		// ENOENT: a missing file is already the desired end state.
	}
	return row;
}

// The Lesson delete's cascade (spec #222): collect this Lesson's Attachment ids before the row
// delete — the join disappears with it — remove every row in one statement alongside the Link
// cascade, then unlink each file. Called from deleteLesson before the Lesson row itself goes, so
// the FK to lesson_id is never left dangling.
export function deleteAttachmentsOfLesson(db: Db, lessonId: string, dir: string) {
	const rows = attachmentsOf(db, lessonId);
	db.delete(schema.attachment).where(eq(schema.attachment.lessonId, lessonId)).run();
	for (const row of rows) {
		try {
			unlinkSync(join(dir, row.id));
		} catch {
			// ENOENT: a missing file is already the desired end state.
		}
	}
}

// Appended at the next position in its Lesson's own order, independent of Link's — the sections
// are separate, so there is no shared order for a shared counter to serve (spec #220).
export function createAttachment(
	db: Db,
	{
		lessonId,
		filename,
		mimeType,
		bytes
	}: { lessonId: string; filename: string; mimeType: string; bytes: Uint8Array },
	dir: string
): typeof schema.attachment.$inferSelect {
	// Browsers report the Content-Type inconsistently across platforms, and decorate it with
	// parameters. Normalise before checking, and store the normalised form — never arbitrary
	// client input, but not server-derived either (spec #220) — so the serving route never
	// sends an empty or decorated Content-Type.
	const normalized = mimeType.split(';')[0].trim().toLowerCase() || 'application/octet-stream';
	const reason = rejectionReason(filename, normalized, bytes.length);
	if (reason) throw new AttachmentRejected(reason);

	const id = crypto.randomUUID();
	const position = nextPosition(
		db
			.select({ position: schema.attachment.position })
			.from(schema.attachment)
			.where(eq(schema.attachment.lessonId, lessonId))
			.all()
	);

	// File first, row second: a row must never exist without its file — that state is the
	// serving route's 500. If the row fails, undo the file in the same call; a leftover file
	// with no row is invisible, and the crash window exists in either order.
	mkdirSync(dir, { recursive: true });
	const path = join(dir, id);
	writeFileSync(path, bytes);
	try {
		const [row] = db
			.insert(schema.attachment)
			.values({ id, lessonId, filename, mimeType: normalized, size: bytes.length, position })
			.returning()
			.all();
		return row;
	} catch (cause) {
		try {
			unlinkSync(path);
		} catch {
			// The file may already be gone; a missing file is the desired end state.
		}
		throw cause;
	}
}
