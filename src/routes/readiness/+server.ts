import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { setReadiness } from '$lib/server/planner';
import type { RequestHandler } from './$types';

// The Ready tick's JSON endpoint (issue #120).
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	if (
		typeof body.lessonId !== 'string' ||
		typeof body.classId !== 'string' ||
		typeof body.ready !== 'boolean'
	) {
		error(400, 'lessonId, classId, and ready boolean are required.');
	}

	setReadiness(db, body.lessonId, body.classId, body.ready);
	return json({ ok: true, ready: body.ready });
};
