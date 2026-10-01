import { json } from '@sveltejs/kit';
import { DATABASE_URL, db } from '$lib/server/db/client';
import { lesson } from '$lib/server/db/schema';
import { requireApiKey } from '$lib/server/api-key';
import { refusalJson, requireExisting } from '$lib/server/api-helpers';
import { attachmentsDir, createAttachment } from '$lib/server/planner';
import type { RequestHandler } from './$types';

// Thin over the seam's create, like the Lesson editor's form action: the allow-list, the size
// ceiling and the mismatch refusal all live in `createAttachment`. Only its own refusal is a 400;
// anything else (a disk fault, a foreign-key violation) is a server fault and is left to throw.
export const POST: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const missing = requireExisting(db, lesson, event.params.id, 'Lesson not found.');
	if (missing) return missing;

	const data = await event.request.formData();
	const file = data.get('file');
	if (!(file instanceof File) || !file.name) {
		return json({ error: 'Send a "file" field with the file to attach.' }, { status: 400 });
	}

	try {
		const created = createAttachment(
			db,
			{
				lessonId: event.params.id,
				filename: file.name,
				mimeType: file.type,
				bytes: new Uint8Array(await file.arrayBuffer())
			},
			attachmentsDir(DATABASE_URL)
		);
		return json(created, { status: 201 });
	} catch (error) {
		return refusalJson(error);
	}
};
