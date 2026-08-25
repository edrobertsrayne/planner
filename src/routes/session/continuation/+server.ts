import { error, json } from '@sveltejs/kit';
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { recordContinuation, sessionDetail } from '$lib/server/planner';
import { occasionOf } from '../occasion';
import type { RequestHandler } from './$types';

// The Session panel's "needs more time" control (issue #38): marks the Session at this occasion
// as a Continuation, widening its Lesson onto the next Available Slot for the Class. Only ever
// touches that one Class's Sessions — never the Lesson itself.
export const POST: RequestHandler = async ({ request }) => {
	const occasion = occasionOf(await request.json());

	try {
		const report = recordContinuation(db, { ...occasion, today: today() });
		return json({ ...sessionDetail(db, occasion), atRisk: report.atRisk });
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'Could not record the Continuation.');
	}
};
