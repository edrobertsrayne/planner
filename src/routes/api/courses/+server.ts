import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { requireApiKey } from '$lib/server/api-key';
import { readJson, refusalJson, stringField } from '$lib/server/api-helpers';
import { createCourse, listCourses } from '$lib/server/planner';
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

	const body = await readJson(event.request);
	if (body instanceof Response) return body;

	const name = stringField(body.name, 'name');
	if (name instanceof Response) return name;

	try {
		const created = createCourse(db, { name });
		return json({ id: created.id, name: created.name }, { status: 201 });
	} catch (error) {
		return refusalJson(error);
	}
};
