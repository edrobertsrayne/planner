import { json } from '@sveltejs/kit';
import { today } from '$lib/date';
import { DATABASE_URL, db } from '$lib/server/db/client';
import { lessonFields, readJson, refusalJson } from '$lib/server/api-helpers';
import {
	attachmentsDir,
	attachmentsOf,
	lessonDetail,
	deleteLesson,
	editLesson,
	reportOf
} from '$lib/server/planner';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const detail = lessonDetail(db, event.params.id);
	if (!detail) return json({ error: 'Lesson not found.' }, { status: 404 });

	return json({ ...detail, attachments: attachmentsOf(db, event.params.id) });
};

export const PATCH: RequestHandler = async (event) => {
	const body = await readJson(event.request);
	if (body instanceof Response) return body;

	const fields = lessonFields(body);
	if (fields instanceof Response) return fields;

	if (body.topicId !== undefined) {
		if (body.topicId !== null && typeof body.topicId !== 'string') {
			return json({ error: 'The "topicId" field must be a string or null.' }, { status: 400 });
		}
		fields.topicId = body.topicId;
	}

	try {
		const result = editLesson(db, { id: event.params.id, change: fields, today: today() });

		// An unknown lesson id is a URL miss — the route's own 404, not the seam's.
		if (!result) return json({ error: 'Lesson not found.' }, { status: 404 });
		return json({ lesson: result.lesson, report: reportOf(result) });
	} catch (error) {
		return refusalJson(error);
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		const result = deleteLesson(db, {
			id: event.params.id,
			today: today(),
			dir: attachmentsDir(DATABASE_URL)
		});

		// The confirm question is the one failure that is not a refusal; the API never confirms, so
		// a Lesson that a Sequence holds stays a 409 that names the Classes.
		if (!result) return json({ error: 'Lesson not found.' }, { status: 404 });
		if ('needsConfirm' in result) return json({ error: result.reason }, { status: 409 });
		return new Response(null, { status: 204 });
	} catch (error) {
		return refusalJson(error);
	}
};
