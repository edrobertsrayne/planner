import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { readJson, refusalJson, stringField } from '$lib/server/api-helpers';
import { courseById, topicsOf, createTopic } from '$lib/server/planner';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	if (!courseById(db, event.params.id)) {
		return json({ error: 'Course not found.' }, { status: 404 });
	}

	const topics = topicsOf(db, event.params.id);
	topics.sort((a, b) => a.name.localeCompare(b.name));

	return json(topics.map((t) => ({ id: t.id, name: t.name, courseId: t.courseId })));
};

// No existence check here: `createTopic` refuses a Course the database does not hold, and that
// refusal is the route's 404.
export const POST: RequestHandler = async (event) => {
	const body = await readJson(event.request);
	if (body instanceof Response) return body;

	const name = stringField(body.name, 'name');
	if (name instanceof Response) return name;

	try {
		const created = createTopic(db, { courseId: event.params.id, name });
		return json(
			{ id: created.id, name: created.name, courseId: created.courseId },
			{ status: 201 }
		);
	} catch (error) {
		return refusalJson(error);
	}
};
