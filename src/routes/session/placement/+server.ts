import { error, json } from '@sveltejs/kit';
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { placeLesson, removePlacement, reportOf, sessionDetail } from '$lib/server/planner';
import { occasionOf, refusal } from '../occasion';
import type { RequestHandler } from './$types';

// The Place-a-Lesson card on the Session page and the Calendar day menu's Place-a-Lesson group
// both talk to this one route (issue #254). The client never learns a Slot's id: it names the
// occasion, and the seam finds the Slot and owns every refusal (ADR-0025), so this door holds no
// rule of its own. A placed Lesson is written in the Lesson editor.
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const occasion = occasionOf(body);
	const title = typeof body.title === 'string' ? body.title : '';

	const now = today();
	try {
		const placed = placeLesson(db, {
			...occasion,
			title,
			today: now
		});

		return json({
			...sessionDetail(db, { ...occasion, today: now }),
			report: reportOf(placed)
		});
	} catch (e) {
		refusal(e);
	}
};

// Removes the Placement named by `SessionDetail.placement.id` and returns the refreshed detail —
// the tile behind the panel returns to an Open Slot in the same round trip.
export const DELETE: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const occasion = occasionOf(body);
	const id = typeof body.id === 'string' ? body.id : '';
	if (!id) error(400, 'id is required.');

	const now = today();
	const report = removePlacement(db, { id, today: now });
	if (!report) error(404, 'No such Placement.');

	return json({ ...sessionDetail(db, { ...occasion, today: now }), report });
};
