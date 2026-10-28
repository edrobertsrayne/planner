import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { apiRoute, notFound, readJson, stringField } from '$lib/server/api-helpers';
import { topicById, renameTopic, deleteTopic } from '$lib/server/planner';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = apiRoute(async (event) => {
	const record = topicById(db, event.params.id) ?? notFound('Topic not found.');

	return json({ id: record.id, name: record.name, courseId: record.courseId });
});

export const PATCH: RequestHandler = apiRoute(async (event) => {
	const body = await readJson(event.request);

	// PATCH is partial: a body that names no field changes nothing and answers the stored record.
	if (body.name === undefined) {
		const record = topicById(db, event.params.id) ?? notFound('Topic not found.');
		return json({ id: record.id, name: record.name, courseId: record.courseId });
	}

	const name = stringField(body.name, 'name');
	const updated = renameTopic(db, { id: event.params.id, name });

	// An unknown id is a URL miss — the route's own 404, not the seam's.
	if (!updated) notFound('Topic not found.');
	return json({ id: updated.id, name: updated.name, courseId: updated.courseId });
});

// A Topic with Lessons is an `unconfirmed` refusal, which the wrapper answers 409; an unknown id
// is the route's own 404.
export const DELETE: RequestHandler = apiRoute(async (event) => {
	const result = deleteTopic(db, event.params.id);

	if (!result) notFound('Topic not found.');
	return new Response(null, { status: 204 });
});
