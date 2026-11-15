import { error, json } from '@sveltejs/kit';
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { sessionDetail, setReadiness } from '$lib/server/planner';
import { bodyOf, occasionOf } from '../occasion';
import type { RequestHandler } from './$types';

// The Session page's Ready control: the Readiness of the occasion's Lesson for its Class
// (ADR-0014), the same record the Agenda row ticks. Answers with the Session as it now stands.
export const POST: RequestHandler = async ({ request }) => {
	const body = await bodyOf(request);
	const occasion = occasionOf(body);
	if (typeof body.lessonId !== 'string' || !body.lessonId) error(400, 'lessonId is required.');
	if (typeof body.ready !== 'boolean') error(400, 'ready must be true or false.');

	setReadiness(db, body.lessonId, occasion.classId, body.ready);
	return json(sessionDetail(db, { ...occasion, today: today() }));
};
