import { json } from '@sveltejs/kit';
import { today } from '$lib/date';
import { DATABASE_URL, db } from '$lib/server/db/client';
import { requireApiKey } from '$lib/server/api-key';
import { refusalJson, stringField } from '$lib/server/api-helpers';
import {
	attachmentsDir,
	attachmentsOf,
	lessonDetail,
	deleteLesson,
	patchLesson
} from '$lib/server/planner';
import type { RequestHandler } from './$types';

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

	const fields: {
		title?: string;
		body?: string | null;
		length?: number;
		status?: string;
		topicId?: string;
	} = {};

	if (data.title !== undefined) {
		const title = stringField(data.title, 'title');
		if (title instanceof Response) return title;
		fields.title = title;
	}

	if (data.body !== undefined) {
		if (data.body !== null && typeof data.body !== 'string') {
			return json({ error: 'The "body" field must be a string or null.' }, { status: 400 });
		}
		fields.body = data.body;
	}

	if (data.length !== undefined) {
		if (typeof data.length !== 'number') {
			return json({ error: 'The "length" field must be a number.' }, { status: 400 });
		}
		fields.length = data.length;
	}

	if (data.status !== undefined) {
		const status = stringField(data.status, 'status');
		if (status instanceof Response) return status;
		fields.status = status;
	}

	if (data.topicId !== undefined) {
		if (data.topicId !== null && typeof data.topicId !== 'string') {
			return json({ error: 'The "topicId" field must be a string or null.' }, { status: 400 });
		}
		fields.topicId = data.topicId;
	}

	try {
		const lesson = patchLesson(db, { id: event.params.id, fields, today: today() });

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
			today: today(),
			dir: attachmentsDir(DATABASE_URL)
		});

		if (!lesson) return json({ error: 'Lesson not found.' }, { status: 404 });
		return new Response(null, { status: 204 });
	} catch (error) {
		return refusalJson(error);
	}
};
