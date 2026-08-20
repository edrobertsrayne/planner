import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { recordContinuation, sessionDetail } from '$lib/server/planner';
import type { RequestHandler } from './$types';

function today() {
	return new Date().toISOString().slice(0, 10);
}

// The Session panel's "needs more time" control (issue #38): marks the Session at this occasion
// as a Continuation, widening its Lesson onto the next Available Slot for the Class. Only ever
// touches that one Class's Sessions — never the Lesson itself.
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const classId = typeof body.classId === 'string' ? body.classId : '';
	const date = typeof body.date === 'string' ? body.date : '';
	const period = Number(body.period);
	if (!classId || !date || !Number.isInteger(period))
		error(400, 'classId, date and period are required.');

	try {
		recordContinuation(db, { classId, date, period, today: today() });
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'Could not record the Continuation.');
	}

	return json(sessionDetail(db, { classId, date, period }));
};
