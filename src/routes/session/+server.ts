import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { sessionDetail, writeSessionNote } from '$lib/server/planner';
import type { RequestHandler } from './$types';

// The Session panel's own endpoint (issue #35) — the only route that reads or writes a Session.
// A Session is identified by its occasion (Class, date, Period), not by a row id, so both methods
// take that triple rather than an id.
function occasionFromQuery(params: URLSearchParams) {
	return occasionOf({
		classId: params.get('classId'),
		date: params.get('date'),
		period: params.get('period')
	});
}

function occasionOf(input: { classId: unknown; date: unknown; period: unknown }) {
	const classId = typeof input.classId === 'string' ? input.classId : '';
	const date = typeof input.date === 'string' ? input.date : '';
	const period = Number(input.period);
	if (!classId || !date || !Number.isInteger(period))
		error(400, 'classId, date and period are required.');
	return { classId, date, period };
}

export const GET: RequestHandler = ({ url }) => {
	const occasion = occasionFromQuery(url.searchParams);
	const detail = sessionDetail(db, occasion);
	if (!detail) error(404, 'No such Class.');
	return json(detail);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { classId, date, period } = occasionOf(body);
	const note = typeof body.note === 'string' && body.note.length > 0 ? body.note : null;

	writeSessionNote(db, { classId, date, period, note });
	return json(sessionDetail(db, { classId, date, period }));
};
