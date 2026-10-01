import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { link } from '$lib/server/db/schema';
import { requireApiKey } from '$lib/server/api-key';
import { refusalJson, stringField } from '$lib/server/api-helpers';
import { deleteLink, updateLink } from '$lib/server/planner/authoring';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const data = await event.request.json();

	const [existing] = db.select().from(link).where(eq(link.id, event.params.id)).all();
	if (!existing) return json({ error: 'Link not found.' }, { status: 404 });

	// PATCH is partial: an absent field keeps its stored value, and the seam's rules run over
	// the merged pair, the same as the Lesson editor's full update.
	const url = data.url === undefined ? existing.url : stringField(data.url, 'url');
	if (url instanceof Response) return url;

	const label = data.label === undefined ? existing.label : stringField(data.label, 'label');
	if (label instanceof Response) return label;

	try {
		return json(updateLink(db, { id: event.params.id, url, label }));
	} catch (error) {
		return refusalJson(error);
	}
};

export const DELETE: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const result = deleteLink(db, { id: event.params.id });
	if (!result) return json({ error: 'Link not found.' }, { status: 404 });

	return new Response(null, { status: 204 });
};
