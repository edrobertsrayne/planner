import { json } from '@sveltejs/kit';
import { DATABASE_URL, client, closeDatabase, reopenDatabase } from '$lib/server/db/client';
import { RestoreRefused, restoreBackup } from '$lib/server/backup/restore';
import { hasUser } from '$lib/server/setup';
import type { RequestHandler } from './$types';

let restoring = false;

// Restore (ADR-0024). It lives under /setup, so the guard in src/hooks.server.ts already turns
// away every request once a user exists; the checks here hold at the moment of writing. The raw
// file is the request body, streamed to disk, and this is the one route exempt from the body limit
// in src/lib/server/body-limit.ts.
export const POST: RequestHandler = async ({ request }) => {
	if (restoring) return json({ error: 'A Restore is already running.' }, { status: 409 });
	restoring = true;

	try {
		const assertNoUser = async () => {
			if (await hasUser()) throw new RestoreRefused('This planner already has an account.');
		};
		await assertNoUser();

		await restoreBackup({
			body: request.body ?? new Blob([]).stream(),
			contentLength: Number(request.headers.get('content-length')) || null,
			databaseUrl: DATABASE_URL,
			live: { client, close: closeDatabase, reopen: reopenDatabase },
			assertNoUser
		});
		return json({ restored: true });
	} catch (error) {
		if (error instanceof RestoreRefused) return json({ error: error.message }, { status: 400 });
		console.error('Restore failed', error);
		return json({ error: 'The Restore failed. Nothing was changed.' }, { status: 500 });
	} finally {
		restoring = false;
	}
};
