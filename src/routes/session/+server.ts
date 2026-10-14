import { error, json } from '@sveltejs/kit';
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { sessionDetail, writeTeachingNote } from '$lib/server/planner';
import { occasionFromQuery, occasionOf, refusal } from './occasion';
import type { RequestHandler } from './$types';

// The Session page's own endpoint (issue #35) — the only route that reads or writes a Session. The
// note it writes is the Teaching note of the occasion's Lesson (ADR-0026).
export const GET: RequestHandler = ({ url }) => {
	const detail = sessionDetail(db, { ...occasionFromQuery(url.searchParams), today: today() });
	if (!detail) error(404, 'No such Class.');
	return json(detail);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const occasion = occasionOf(body);
	const note = typeof body.note === 'string' && body.note.length > 0 ? body.note : null;

	try {
		writeTeachingNote(db, { ...occasion, note });
	} catch (e) {
		refusal(e);
	}
	return json(sessionDetail(db, { ...occasion, today: today() }));
};
