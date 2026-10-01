import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { requireApiKey } from '$lib/server/api-key';
import { refusalJson, stringField } from '$lib/server/api-helpers';
import { createCourse, listCourses } from '$lib/server/planner/authoring';
import type { RequestHandler } from './$types';

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

	const name = stringField(body.name, 'name');
	if (name instanceof Response) return name;

	try {
		const created = createCourse(db, { name });
		return json({ id: created.id, name: created.name }, { status: 201 });
	} catch (error) {
		return refusalJson(error);
	}
};
