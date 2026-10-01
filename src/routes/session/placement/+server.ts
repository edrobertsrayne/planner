import { error, json } from '@sveltejs/kit';
import { today } from '$lib/date';
import { client, db } from '$lib/server/db/client';
import {
	classSchedule,
	placeLesson,
	removePlacement,
	sessionDetail,
	setLessonStatus,
	updateLesson,
	type WriteReport
} from '$lib/server/planner';
import { occasionOf, refusal } from '../occasion';
import type { RequestHandler } from './$types';

// The Session panel's Place-a-Lesson card and the Calendar day menu's Place-a-Lesson group both
// talk to this one route (issue #254). The client never learns a Slot's id: POST resolves it
// server-side from the Class's own schedule — its Open Slots and the Slots its Lessons already
// hold alike (issue #256), since a Placement claims its Slot ahead of the Topic stream and
// shift-rights whatever sat there. A Slot already holding a placed Lesson is the one refusal: a
// second Placement on one anchor collides on `placement_anchor`, and both doors leave that Slot
// out, so only a stale click reaches here.
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const occasion = occasionOf(body);
	const title = typeof body.title === 'string' ? body.title : '';

	const now = today();
	const { scheduled, openSlots } = classSchedule(db, { classId: occasion.classId, today: now });
	const atOccasion = (s: { date: string; period: number }) =>
		s.date === occasion.date && s.period === occasion.period;
	const slot = openSlots.find(atOccasion) ?? scheduled.find(atOccasion);
	if (!slot) error(400, `${occasion.date} P${occasion.period} is not an Available Slot.`);
	if ('placementId' in slot && slot.placementId)
		error(400, `${occasion.date} P${occasion.period} already holds a placed Lesson.`);

	try {
		const { atRisk, placementsMoved } = placeLesson(db, client, {
			classId: occasion.classId,
			date: occasion.date,
			slotId: slot.slotId,
			title,
			today: now
		});

		return json({
			...sessionDetail(db, { ...occasion, today: now }),
			report: { atRisk, placementsMoved }
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

// Writes a placed Standalone Lesson's title, plan, Length and Draft/Planned mark from the Session
// panel — the only door onto it, since a Standalone Lesson reaches no Lesson editor (ADR-0022). A
// Topic Lesson's plan stays read-only here; this route refuses when the occasion carries no
// Placement. Each field is optional and merged over the Lesson's current values; a Length change
// re-derives every Class this Lesson is placed on the same way the Lesson editor's does, while a
// status change never re-derives (ADR-0014).
export const PATCH: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const occasion = occasionOf(body);
	const now = today();
	const before = sessionDetail(db, { ...occasion, today: now });
	if (!before?.placement || !before.lesson) error(404, 'No placed Lesson on this occasion.');

	let report: WriteReport = { atRisk: [], placementsMoved: [] };

	try {
		if ('title' in body || 'body' in body || 'length' in body) {
			const result = updateLesson(db, {
				id: before.lesson.id,
				title:
					'title' in body
						? typeof body.title === 'string'
							? body.title
							: ''
						: before.lesson.title,
				body:
					'body' in body ? (typeof body.body === 'string' ? body.body : null) : before.lesson.body,
				length: 'length' in body ? Number(body.length) : before.lesson.length,
				today: now
			});
			if (result) report = { atRisk: result.atRisk, placementsMoved: result.placementsMoved };
		}

		if ('status' in body) setLessonStatus(db, before.lesson.id, String(body.status));
	} catch (e) {
		refusal(e);
	}

	return json({ ...sessionDetail(db, { ...occasion, today: now }), report });
};
