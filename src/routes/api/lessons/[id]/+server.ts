import { json } from '@sveltejs/kit';
import { DATABASE_URL, db } from '$lib/server/db/client';
import { requireApiKey } from '$lib/server/api-key';
import {
	MAX_NAME_LENGTH,
	refusalJson,
	rejectUnknownFields,
	validateString,
	validateStatus,
	validateLength,
	getDateToday
} from '$lib/server/api-helpers';
import {
	attachmentsDir,
	attachmentsOf,
	lessonDetail,
	deleteLesson,
	patchLesson
} from '$lib/server/planner';
import type { RequestHandler } from './$types';

const LESSON_FIELDS = new Set(['title', 'body', 'length', 'status', 'topicId']);

export const GET: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const detail = lessonDetail(db, event.params.id);
	if (!detail) return json({ error: 'Lesson not found.' }, { status: 404 });

	return json({ ...detail, attachments: attachmentsOf(db, event.params.id) });
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

	try {
		const lesson = patchLesson(db, { id: event.params.id, fields, today });

		// An unknown lesson id is a URL miss — the route's own 404, not the seam's.
		if (!lesson) return json({ error: 'Lesson not found.' }, { status: 404 });
		return json(lesson);
	} catch (error) {
		return refusalJson(error);
	}
};

export const DELETE: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	try {
		const lesson = deleteLesson(db, {
			id: event.params.id,
			today: getDateToday(),
			dir: attachmentsDir(DATABASE_URL)
		});

		if (!lesson) return json({ error: 'Lesson not found.' }, { status: 404 });
		return new Response(null, { status: 204 });
	} catch (error) {
		return refusalJson(error);
	}
};
