import { error } from '@sveltejs/kit';
import { client, DATABASE_URL } from '$lib/server/db/client';
import { createBackup } from '$lib/server/backup/backup';
import type { RequestHandler } from './$types';

// Back up (ADR-0024). Outside `/api`, like /attachments: the download is for a browser session,
// and the ordinary session guard in src/hooks.server.ts redirects a signed-out request before it
// reaches here.
export const GET: RequestHandler = () => {
	let backup: ReturnType<typeof createBackup>;
	try {
		backup = createBackup(client, DATABASE_URL);
	} catch (cause) {
		// Usually an Attachment row whose file is gone. Log the detail; the page gets no path.
		console.error('Back up failed', cause);
		error(500, 'The Backup could not be made. An Attachment file may be missing.');
	}
	const { size, body } = backup;
	const date = new Date().toISOString().slice(0, 10);

	return new Response(body, {
		headers: {
			'Content-Type': 'application/x-tar',
			'Content-Length': String(size),
			'Content-Disposition': `attachment; filename="planner-backup-${date}.tar"`
		}
	});
};
