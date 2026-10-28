import { json } from '@sveltejs/kit';
import { DATABASE_URL, db } from '$lib/server/db/client';
import { ApiFailure, apiRoute } from '$lib/server/api-helpers';
import { attachmentsDir, createAttachment } from '$lib/server/planner';
import type { RequestHandler } from './$types';

const NO_FILE = 'Send a "file" field with the file to attach.';

// Thin over the seam's create, like the Lesson editor's form action: the allow-list, the size
// ceiling and the mismatch refusal all live in `createAttachment`. Only its own refusal is a 400;
// anything else (a disk fault, a foreign-key violation) is a server fault and is left to throw.
export const POST: RequestHandler = apiRoute(async (event) => {
	// A request that is not multipart makes `formData()` throw; it is the same 400 as a multipart
	// request with no `file` part, because the caller sent no file in either case.
	let data: FormData;
	try {
		data = await event.request.formData();
	} catch {
		throw new ApiFailure(400, NO_FILE);
	}

	const file = data.get('file');
	if (!(file instanceof File) || !file.name) throw new ApiFailure(400, NO_FILE);

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
});
