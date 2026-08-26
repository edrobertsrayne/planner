import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { topic } from '$lib/server/db/schema';
import { requireApiKey } from '$lib/server/api-key';
import {
	rejectUnknownFields,
	validateString,
	validateStatus,
	validateLength,
	getDateToday
} from '$lib/server/api-helpers';
import { lessonsOf, createLesson } from '$lib/server/planner/authoring';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const LESSON_FIELDS = new Set(['title', 'body', 'length', 'status']);

export const GET: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const [existing] = db
		.select({ id: topic.id })
		.from(topic)
		.where(eq(topic.id, event.params.id))
		.all();
	if (!existing) return json({ error: 'Topic not found.' }, { status: 404 });

	const lessons = lessonsOf(db, event.params.id);
	return json(lessons);
};

export const POST: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const [existing] = db
		.select({ id: topic.id })
		.from(topic)
		.where(eq(topic.id, event.params.id))
		.all();
	if (!existing) return json({ error: 'Topic not found.' }, { status: 404 });

	const data = await event.request.json();

	const unknown = rejectUnknownFields(data, LESSON_FIELDS);
	if (unknown) return unknown;

	const title = validateString(data.title ?? '', 'title', 200);
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
