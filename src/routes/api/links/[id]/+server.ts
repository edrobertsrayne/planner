import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { apiRoute, notFound, readJson, stringField } from '$lib/server/api-helpers';
import { deleteLink, linkById, updateLink } from '$lib/server/planner';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = apiRoute(async (event) => {
	const existing = linkById(db, event.params.id) ?? notFound('Link not found.');

	const data = await readJson(event.request);

	// PATCH is partial: an absent field keeps its stored value, and the seam's rules run over
	// the merged pair, the same as the Lesson editor's full update.
	const url = data.url === undefined ? existing.url : stringField(data.url, 'url');
	const label = data.label === undefined ? existing.label : stringField(data.label, 'label');

	return json(updateLink(db, { id: event.params.id, url, label }));
});

export const DELETE: RequestHandler = apiRoute(async (event) => {
	const result = deleteLink(db, { id: event.params.id });
	if (!result) notFound('Link not found.');

	return new Response(null, { status: 204 });
});
