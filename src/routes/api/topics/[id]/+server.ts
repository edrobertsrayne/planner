import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { readJson, refusalJson, stringField } from '$lib/server/api-helpers';
import { topicById, renameTopic, deleteTopic } from '$lib/server/planner';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const record = topicById(db, event.params.id);
	if (!record) return json({ error: 'Topic not found.' }, { status: 404 });

	return json({ id: record.id, name: record.name, courseId: record.courseId });
};

export const PATCH: RequestHandler = async (event) => {
	const body = await readJson(event.request);
	if (body instanceof Response) return body;

	// PATCH is partial: a body that names no field changes nothing and answers the stored record.
	if (body.name === undefined) {
		const record = topicById(db, event.params.id);
		if (!record) return json({ error: 'Topic not found.' }, { status: 404 });
		return json({ id: record.id, name: record.name, courseId: record.courseId });
	}

	const name = stringField(body.name, 'name');
	if (name instanceof Response) return name;

	try {
		const updated = renameTopic(db, { id: event.params.id, name });

		// An unknown id is a URL miss — the route's own 404, not the seam's.
		if (!updated) return json({ error: 'Topic not found.' }, { status: 404 });
		return json({ id: updated.id, name: updated.name, courseId: updated.courseId });
	} catch (error) {
		return refusalJson(error);
	}
};

// A Topic with Lessons is a confirm question, which the API answers as its 409; an unknown id is
// the route's own 404. Neither is a refusal, so nothing here can throw one.
export const DELETE: RequestHandler = async (event) => {
	const result = deleteTopic(db, event.params.id);
	if (!result) return json({ error: 'Topic not found.' }, { status: 404 });
	if ('needsConfirm' in result) return json({ error: result.reason }, { status: 409 });

	return new Response(null, { status: 204 });
};
