import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { apiRoute, readJson, stringField } from '$lib/server/api-helpers';
import { createCourse, listCourses } from '$lib/server/planner';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = apiRoute(async () => {
	const courses = listCourses(db);

	return json(courses.map((c) => ({ id: c.id, name: c.name })));
});

export const POST: RequestHandler = apiRoute(async (event) => {
	const body = await readJson(event.request);
	const name = stringField(body.name, 'name');

	const created = createCourse(db, { name });
	return json({ id: created.id, name: created.name }, { status: 201 });
});
