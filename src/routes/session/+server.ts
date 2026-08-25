import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { sessionDetail, writeSessionNote } from '$lib/server/planner';
import { occasionFromQuery, occasionOf } from './occasion';
import type { RequestHandler } from './$types';

// The Session panel's own endpoint (issue #35) — the only route that reads or writes a Session.
export const GET: RequestHandler = ({ url }) => {
	const detail = sessionDetail(db, occasionFromQuery(url.searchParams));
	if (!detail) error(404, 'No such Class.');
	return json(detail);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const occasion = occasionOf(body);
	const note = typeof body.note === 'string' && body.note.length > 0 ? body.note : null;

	writeSessionNote(db, { ...occasion, note });
	return json(sessionDetail(db, occasion));
};
