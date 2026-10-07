import { json } from '@sveltejs/kit';
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { topic } from '$lib/server/db/schema';
import { requireApiKey } from '$lib/server/api-key';
import { refusalJson, requireExisting, stringField } from '$lib/server/api-helpers';
import { lessonsOf, createLesson } from '$lib/server/planner/authoring';
import { reportOf } from '$lib/server/planner';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const missing = requireExisting(db, topic, event.params.id, 'Topic not found.');
	if (missing) return missing;

	const lessons = lessonsOf(db, event.params.id);
	return json(lessons);
};

export const POST: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const missing = requireExisting(db, topic, event.params.id, 'Topic not found.');
	if (missing) return missing;

	const data = await event.request.json();

	const title = stringField(data.title, 'title');
	if (title instanceof Response) return title;

	if (data.body !== undefined && data.body !== null && typeof data.body !== 'string') {
		return json({ error: 'The "body" field must be a string or null.' }, { status: 400 });
	}
	if (data.length !== undefined && typeof data.length !== 'number') {
		return json({ error: 'The "length" field must be a number.' }, { status: 400 });
	}
	const status = data.status === undefined ? undefined : stringField(data.status, 'status');
	if (status instanceof Response) return status;

	try {
		const created = createLesson(db, {
			topicId: event.params.id,
			title,
			body: data.body,
			length: data.length,
			status,
			today: today()
		});
		return json({ ...created.lesson, links: [], report: reportOf(created) }, { status: 201 });
	} catch (error) {
		return refusalJson(error);
	}
};
