import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { course } from '$lib/server/db/schema';
import { requireApiKey } from '$lib/server/api-key';
import { refusalJson, requireExisting, stringField } from '$lib/server/api-helpers';
import { topicsOf, createTopic } from '$lib/server/planner/authoring';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const missing = requireExisting(db, course, event.params.id, 'Course not found.');
	if (missing) return missing;

	const topics = topicsOf(db, event.params.id);
	topics.sort((a, b) => a.name.localeCompare(b.name));

	return json(topics.map((t) => ({ id: t.id, name: t.name, courseId: t.courseId })));
};

export const POST: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const missing = requireExisting(db, course, event.params.id, 'Course not found.');
	if (missing) return missing;

	const body = await event.request.json();

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
