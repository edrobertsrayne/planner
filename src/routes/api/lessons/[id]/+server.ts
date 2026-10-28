import { json } from '@sveltejs/kit';
import { today } from '$lib/date';
import { DATABASE_URL, db } from '$lib/server/db/client';
import { ApiFailure, apiRoute, lessonFields, notFound, readJson } from '$lib/server/api-helpers';
import {
	attachmentsDir,
	deleteLesson,
	editLesson,
	lessonDetail,
	reportOf
} from '$lib/server/planner';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = apiRoute(async (event) => {
	const detail = lessonDetail(db, event.params.id) ?? notFound('Lesson not found.');

	return json(detail);
});

export const PATCH: RequestHandler = apiRoute(async (event) => {
	const body = await readJson(event.request);
	const fields = lessonFields(body);

	if (body.topicId !== undefined) {
		if (body.topicId !== null && typeof body.topicId !== 'string') {
			throw new ApiFailure(400, 'The "topicId" field must be a string or null.');
		}
		fields.topicId = body.topicId;
	}

	const result = editLesson(db, { id: event.params.id, change: fields, today: today() });

	// An unknown lesson id is a URL miss — the route's own 404, not the seam's.
	if (!result) notFound('Lesson not found.');
	return json({ lesson: result.lesson, report: reportOf(result) });
});

// A Lesson that a Sequence holds is the seam's `unconfirmed` refusal, which the wrapper answers
// 409 naming the Classes. An unknown id is the route's own 404.
export const DELETE: RequestHandler = apiRoute(async (event) => {
	const result = deleteLesson(db, {
		id: event.params.id,
		today: today(),
		dir: attachmentsDir(DATABASE_URL)
	});

	if (!result) notFound('Lesson not found.');
	return new Response(null, { status: 204 });
});
