import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { course } from '$lib/server/db/schema';
import { requireApiKey } from '$lib/server/api-key';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const [record] = await db.select({ id: course.id, name: course.name }).from(course).where(eq(course.id, event.params.id)).limit(1);

	if (!record) {
		return json({ error: 'Course not found.' }, { status: 404 });
	}

	return json(record);
};