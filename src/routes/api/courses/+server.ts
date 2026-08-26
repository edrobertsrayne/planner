import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { requireApiKey } from '$lib/server/api-key';
import { rejectUnknownFields, validateString } from '$lib/server/api-helpers';
import { createCourse, NameCollision, listCourses } from '$lib/server/planner/authoring';
import type { RequestHandler } from './$types';

const COURSE_FIELDS = new Set(['name']);

export const GET: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const courses = listCourses(db);

	return json(courses.map((c) => ({ id: c.id, name: c.name })));
};

export const POST: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const body = await event.request.json();

	const unknown = rejectUnknownFields(body, COURSE_FIELDS);
	if (unknown) return unknown;

	const name = validateString(body.name, 'name', 200);
	if (name instanceof Response) return name;

	try {
		const created = createCourse(db, { name });
		return json({ id: created.id, name: created.name }, { status: 201 });
	} catch (error) {
		if (error instanceof NameCollision) {
			return json({ error: error.message }, { status: 409 });
		}
		throw error;
	}
};
