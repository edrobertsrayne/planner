import { json } from '@sveltejs/kit';
import { DATABASE_URL, client } from '$lib/server/db/client';
import { RestoreRefused, restoreBackup } from '$lib/server/backup/restore';
import { firstRun, hasUser } from '$lib/server/setup';
import type { RequestHandler } from './$types';

// Restore (ADR-0024). It lives under /setup, so the guard in src/hooks.server.ts already turns
// away every request once a user exists; `restoreBackup` checks again, synchronously, before it
// writes. The raw file is the request body, streamed into the scratch folder, and this is the one
// route exempt from the body limit in src/lib/server/body-limit.ts.
//
// The check and the Restore run under the same first-run queue as the wizard's sign-up, so a
// Restore that arrives beside a sign-up runs after it and sees the user it created.
export const POST: RequestHandler = async ({ request }) => {
	try {
		await firstRun(async () => {
			if (await hasUser()) throw new RestoreRefused('This planner already has an account.');

			await restoreBackup({
				body: request.body ?? new Blob([]).stream(),
				contentLength: Number(request.headers.get('content-length')) || null,
				databaseUrl: DATABASE_URL,
				client
			});
		});
		return json({ restored: true });
	} catch (error) {
		if (error instanceof RestoreRefused) return json({ error: error.message }, { status: 400 });
		console.error('Restore failed', error);
		return json({ error: 'The Restore failed. The planner is still empty.' }, { status: 500 });
	}
};
