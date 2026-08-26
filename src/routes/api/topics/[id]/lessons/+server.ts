import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { topic } from '$lib/server/db/schema';
import { requireApiKey } from '$lib/server/api-key';
import {
	MAX_NAME_LENGTH,
	rejectUnknownFields,
	requireExisting,
	validateString,
	validateStatus,
	validateLength,
	getDateToday
} from '$lib/server/api-helpers';
import { lessonsOf, createLesson } from '$lib/server/planner/authoring';
import type { RequestHandler } from './$types';

const LESSON_FIELDS = new Set(['title', 'body', 'length', 'status']);

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

	const unknown = rejectUnknownFields(data, LESSON_FIELDS);
	if (unknown) return unknown;

	const title = validateString(data.title ?? '', 'title', MAX_NAME_LENGTH);
	if (title instanceof Response) return title;

	let lessonLength: number | undefined;
	if (data.length !== undefined) {
		const result = validateLength(data.length);
		if (result instanceof Response) return result;
		lessonLength = result;
	}

	let lessonStatus: 'draft' | 'planned' | undefined;
	if (data.status !== undefined) {
		const result = validateStatus(data.status);
		if (result instanceof Response) return result;
		lessonStatus = result;
	}

	const today = getDateToday();

	const created = createLesson(db, {
		topicId: event.params.id,
		title,
		body: data.body,
		length: lessonLength,
		status: lessonStatus,
		today
	});

	return json({ ...created, links: [] }, { status: 201 });
};
