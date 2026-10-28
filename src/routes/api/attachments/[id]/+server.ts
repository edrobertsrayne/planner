import { DATABASE_URL, db } from '$lib/server/db/client';
import { apiRoute, notFound } from '$lib/server/api-helpers';
import { attachmentsDir, deleteAttachment } from '$lib/server/planner';
import type { RequestHandler } from './$types';

// Downloads stay browser-only, at `/attachments/[id]`; the API can upload and remove.
export const DELETE: RequestHandler = apiRoute(async (event) => {
	const removed = deleteAttachment(db, event.params.id, attachmentsDir(DATABASE_URL));
	if (!removed) notFound('Attachment not found.');

	return new Response(null, { status: 204 });
});
