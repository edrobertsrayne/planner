import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { apiRoute, notFound, readJson, stringField } from '$lib/server/api-helpers';
import { courseById, renameCourse, deleteCourse } from '$lib/server/planner';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = apiRoute(async (event) => {
	const record = courseById(db, event.params.id) ?? notFound('Course not found.');

	return json({ id: record.id, name: record.name });
});

export const PATCH: RequestHandler = apiRoute(async (event) => {
	const body = await readJson(event.request);

	// PATCH is partial: a body that names no field changes nothing and answers the stored record.
	if (body.name === undefined) {
		const record = courseById(db, event.params.id) ?? notFound('Course not found.');
		return json({ id: record.id, name: record.name });
	}

	const name = stringField(body.name, 'name');
	const updated = renameCourse(db, { id: event.params.id, name });

	// An unknown id is a URL miss — the route's own 404, not the seam's.
	if (!updated) notFound('Course not found.');
	return json({ id: updated.id, name: updated.name });
});

// A delete that needs a confirm is the seam's `unconfirmed` refusal, which the wrapper answers
// 409; the API never confirms.
export const DELETE: RequestHandler = apiRoute(async (event) => {
	const result = deleteCourse(db, event.params.id);

	if (!result) notFound('Course not found.');
	return new Response(null, { status: 204 });
});
