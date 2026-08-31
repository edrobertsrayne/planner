import { json } from '@sveltejs/kit';
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { course } from '$lib/server/db/schema';
import { requireApiKey } from '$lib/server/api-key';
import {
	MAX_NAME_LENGTH,
	rejectUnknownFields,
	requireExisting,
	validateString
} from '$lib/server/api-helpers';
import { renameCourse, deleteCourse, NameCollision } from '$lib/server/planner/authoring';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const COURSE_FIELDS = new Set(['name']);

export const GET: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const [record] = db
		.select({ id: course.id, name: course.name })
		.from(course)
		.where(eq(course.id, event.params.id))
		.all();

	if (!record) {
		return json({ error: 'Course not found.' }, { status: 404 });
	}

	return json(record);
};

export const PATCH: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const missing = requireExisting(db, course, event.params.id, 'Course not found.');
	if (missing) return missing;

	const body = await event.request.json();

	const unknown = rejectUnknownFields(body, COURSE_FIELDS);
	if (unknown) return unknown;

	if (body.name === undefined) {
		const [record] = db
			.select({ id: course.id, name: course.name })
			.from(course)
			.where(eq(course.id, event.params.id))
			.all();
		return json(record);
	}

	const name = validateString(body.name, 'name', MAX_NAME_LENGTH);
	if (name instanceof Response) return name;

	try {
		const updated = renameCourse(db, { id: event.params.id, name });
		if (!updated) {
			return json({ error: 'Course not found.' }, { status: 404 });
		}
		return json({ id: updated.id, name: updated.name });
	} catch (error) {
		if (error instanceof NameCollision) {
			return json({ error: error.message }, { status: 409 });
		}
		throw error;
	}
};

export const DELETE: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const result = deleteCourse(db, event.params.id, { today: today() });

	if (!result.ok) {
		if (result.reason === 'not found') {
			return json({ error: 'Course not found.' }, { status: 404 });
		}
		return json({ error: result.reason }, { status: 409 });
	}

	return new Response(null, { status: 204 });
};
