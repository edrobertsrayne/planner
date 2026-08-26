import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { course } from '$lib/server/db/schema';
import { requireApiKey } from '$lib/server/api-key';
import { asc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const courses = await db.select({ id: course.id, name: course.name }).from(course).orderBy(asc(course.name));

	return json(courses);
};