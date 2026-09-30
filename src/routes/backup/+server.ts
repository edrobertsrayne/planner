import { client, DATABASE_URL } from '$lib/server/db/client';
import { createBackup } from '$lib/server/backup/backup';
import type { RequestHandler } from './$types';

// Back up (ADR-0024). Outside `/api`, like /attachments: the download is for a browser session,
// and the ordinary session guard in src/hooks.server.ts redirects a signed-out request before it
// reaches here.
export const GET: RequestHandler = () => {
	const { size, body } = createBackup(client, DATABASE_URL);
	const date = new Date().toISOString().slice(0, 10);

	return new Response(body, {
		headers: {
			'Content-Type': 'application/x-tar',
			'Content-Length': String(size),
			'Content-Disposition': `attachment; filename="planner-backup-${date}.tar"`
		}
	});
};
