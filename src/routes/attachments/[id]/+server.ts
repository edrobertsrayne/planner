import { error } from '@sveltejs/kit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATABASE_URL, db } from '$lib/server/db/client';
import { attachmentById, attachmentsDir } from '$lib/server/planner';
import type { RequestHandler } from './$types';

// The only place an Attachment's bytes are served (spec #221) — outside `/api` entirely, since
// the API is bearer-key-only and cannot serve a browser download. Sits under the ordinary
// session guard (src/hooks.server.ts) exactly like /session and /logout: a signed-out request
// is redirected before this handler ever runs.
export const GET: RequestHandler = ({ params }) => {
	// A parameterized lookup first: a traversal payload in `params.id` matches no row and 404s
	// here, before the on-disk path — built only from the row's own id, never the raw
	// parameter — ever exists.
	const row = attachmentById(db, params.id);
	if (!row) error(404, 'No such Attachment.');

	const path = join(attachmentsDir(DATABASE_URL), row.id);
	let bytes: Uint8Array;
	try {
		bytes = readFileSync(path);
	} catch (cause) {
		// A row with no file on disk is a data-integrity fault, not a client error: log the id
		// server-side and answer with a body that gives nothing away.
		console.error(`Attachment ${row.id} has no file at ${path}`, cause);
		error(500, 'This Attachment could not be read from disk.');
	}

	// Plain-ASCII fallback plus the UTF-8 percent-encoded form, so an accented filename such as
	// "café-menu.pdf" survives the download rather than arriving mangled or stripped.
	const ascii = row.filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
	const utf8 = encodeURIComponent(row.filename);

	return new Response(new Uint8Array(bytes), {
		headers: {
			'Content-Type': row.mimeType,
			'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`,
			'Content-Length': String(row.size)
		}
	});
};
