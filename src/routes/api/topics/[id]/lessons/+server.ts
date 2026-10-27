import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { apiRoute, lessonFields, notFound, readJson } from '$lib/server/api-helpers';
import { topicById, lessonsOf, createLesson } from '$lib/server/planner';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = apiRoute(async (event) => {
	// A missing Topic answers 404 rather than an empty list: the URL names the record.
	if (!topicById(db, event.params.id)) notFound('Topic not found.');

	return json(lessonsOf(db, event.params.id));
});

export const POST: RequestHandler = apiRoute(async (event) => {
	const body = await readJson(event.request);
	const fields = lessonFields(body);

	// An absent title is an empty one, which the seam refuses: "A Lesson needs a title."
	const created = createLesson(db, {
		topicId: event.params.id,
		title: fields.title ?? '',
		body: fields.body,
		length: fields.length,
		status: fields.status
	});
	// A create answers its record and nothing else, like every other create. A new Lesson is in
	// no Sequence and has no Placement, so it cannot move a Session: there is no report to carry.
	return json(created.lesson, { status: 201 });
});
