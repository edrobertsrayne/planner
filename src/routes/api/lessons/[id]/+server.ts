import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { requireApiKey } from '$lib/server/api-key';
import {
	MAX_NAME_LENGTH,
	rejectUnknownFields,
	validateString,
	validateStatus,
	validateLength,
	getDateToday
} from '$lib/server/api-helpers';
import { lessonDetail, deleteLesson, patchLesson } from '$lib/server/planner/authoring';
import type { RequestHandler } from './$types';

const LESSON_FIELDS = new Set(['title', 'body', 'length', 'status', 'topicId']);

export const GET: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const detail = lessonDetail(db, event.params.id);
	if (!detail) return json({ error: 'Lesson not found.' }, { status: 404 });

	return json(detail);
};

export const PATCH: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const data = await event.request.json();

	const unknown = rejectUnknownFields(data, LESSON_FIELDS);
	if (unknown) return unknown;

	const fields: {
		title?: string;
		body?: string | null;
		length?: number;
		status?: 'draft' | 'planned';
		topicId?: string;
	} = {};

	if (data.title !== undefined) {
		const title = validateString(data.title, 'title', MAX_NAME_LENGTH);
		if (title instanceof Response) return title;
		fields.title = title;
	}

	if (data.body !== undefined) {
		if (data.body !== null && typeof data.body !== 'string') {
			return json({ error: 'The "body" field must be a string or null.' }, { status: 400 });
		}
		if (typeof data.body === 'string' && data.body.length > 100000) {
			return json(
				{ error: 'The "body" field must be at most 100000 characters.' },
				{ status: 400 }
			);
		}
		fields.body = data.body;
	}

	if (data.length !== undefined) {
		const length = validateLength(data.length);
		if (length instanceof Response) return length;
		fields.length = length;
	}

	if (data.status !== undefined) {
		const status = validateStatus(data.status);
		if (status instanceof Response) return status;
		fields.status = status;
	}

	if (data.topicId !== undefined) {
		if (data.topicId !== null && typeof data.topicId !== 'string') {
			return json({ error: 'The "topicId" field must be a string or null.' }, { status: 400 });
		}
		fields.topicId = data.topicId;
	}

	const today = getDateToday();

	const result = patchLesson(db, { id: event.params.id, fields, today });

	if (!result.ok) {
		if (result.reason === 'not found') return json({ error: 'Lesson not found.' }, { status: 404 });
		return json({ error: 'Topic not found.' }, { status: 404 });
	}

	return json(result.lesson);
};

export const DELETE: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const today = getDateToday();
	const result = deleteLesson(db, { id: event.params.id, today });

	if (!result.ok) {
		if (result.reason === 'not found') return json({ error: 'Lesson not found.' }, { status: 404 });
		return json(
			{
				error:
					'A Class has already been taught this Lesson, so it cannot be removed. Detach it instead with PATCH /api/lessons/:id and "topicId": null.'
			},
			{ status: 409 }
		);
	}

	return new Response(null, { status: 204 });
};
