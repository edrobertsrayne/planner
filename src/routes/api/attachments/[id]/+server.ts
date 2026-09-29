import { json } from '@sveltejs/kit';
import { DATABASE_URL, db } from '$lib/server/db/client';
import { requireApiKey } from '$lib/server/api-key';
import { attachmentsDir, deleteAttachment } from '$lib/server/planner';
import type { RequestHandler } from './$types';

// Downloads stay browser-only, at `/attachments/[id]`; the API can upload and remove.
export const DELETE: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const removed = deleteAttachment(db, event.params.id, attachmentsDir(DATABASE_URL));
	if (!removed) return json({ error: 'Attachment not found.' }, { status: 404 });

	return new Response(null, { status: 204 });
};
