import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { readJson, refusalJson, stringField } from '$lib/server/api-helpers';
import { courseById, renameCourse, deleteCourse } from '$lib/server/planner';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const record = courseById(db, event.params.id);
	if (!record) return json({ error: 'Course not found.' }, { status: 404 });

	return json({ id: record.id, name: record.name });
};

export const PATCH: RequestHandler = async (event) => {
	const body = await readJson(event.request);
	if (body instanceof Response) return body;

	// PATCH is partial: a body that names no field changes nothing and answers the stored record.
	if (body.name === undefined) {
		const record = courseById(db, event.params.id);
		if (!record) return json({ error: 'Course not found.' }, { status: 404 });
		return json({ id: record.id, name: record.name });
	}

	const name = stringField(body.name, 'name');
	if (name instanceof Response) return name;

	try {
		const updated = renameCourse(db, { id: event.params.id, name });

		// An unknown id is a URL miss — the route's own 404, not the seam's.
		if (!updated) return json({ error: 'Course not found.' }, { status: 404 });
		return json({ id: updated.id, name: updated.name });
	} catch (error) {
		return refusalJson(error);
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const result = deleteCourse(db, event.params.id);

		// An unknown id is a URL miss — the route's own 404, not the seam's. The confirm question
		// is the one failure that is not a refusal; the API never confirms, so it stays a 409.
		if (!result) return json({ error: 'Course not found.' }, { status: 404 });
		if ('needsConfirm' in result) return json({ error: result.reason }, { status: 409 });

		return new Response(null, { status: 204 });
	} catch (error) {
		return refusalJson(error);
	}
};
