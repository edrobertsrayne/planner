import { error, json } from '@sveltejs/kit';
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { classSchedule, placeLesson, removePlacement, sessionDetail } from '$lib/server/planner';
import { occasionOf } from '../occasion';
import type { RequestHandler } from './$types';

// The Session panel's Place-a-Lesson card and the Calendar day menu's Place-a-Lesson group both
// talk to this one route (issue #254). The client never learns a Slot's id: POST resolves it
// server-side from the Class's own Available Slots, the same stream the day menu's Available-Slot
// lines and `placeLesson` itself already walk.
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const occasion = occasionOf(body);
	const title = typeof body.title === 'string' ? body.title.trim() : '';
	if (!title) error(400, 'A title is required.');

	const now = today();
	const { openSlots } = classSchedule(db, { classId: occasion.classId, today: now });
	const slot = openSlots.find((s) => s.date === occasion.date && s.period === occasion.period);
	if (!slot) error(400, `${occasion.date} P${occasion.period} is not an Available Slot.`);

	const result = placeLesson(db, {
		classId: occasion.classId,
		date: occasion.date,
		slotId: slot.slotId,
		title,
		today: now
	});
	if (!result.ok) error(400, result.reason);
	const { atRisk, placementsMoved } = result;

	return json({
		...sessionDetail(db, { ...occasion, today: now }),
		report: { atRisk, placementsMoved }
	});
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
