import { json } from '@sveltejs/kit';
import { today } from '$lib/date';
import { DATABASE_URL, db } from '$lib/server/db/client';
import { topic } from '$lib/server/db/schema';
import { requireApiKey } from '$lib/server/api-key';
import {
	MAX_NAME_LENGTH,
	rejectUnknownFields,
	requireExisting,
	validateString
} from '$lib/server/api-helpers';
import { renameTopic, deleteTopic, NameCollision } from '$lib/server/planner/authoring';
import { attachmentsDir } from '$lib/server/planner/attachments';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const TOPIC_FIELDS = new Set(['name']);

export const GET: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const [record] = db
		.select({ id: topic.id, name: topic.name, courseId: topic.courseId })
		.from(topic)
		.where(eq(topic.id, event.params.id))
		.all();

	if (!record) return json({ error: 'Topic not found.' }, { status: 404 });

	return json(record);
};

export const PATCH: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const missing = requireExisting(db, topic, event.params.id, 'Topic not found.');
	if (missing) return missing;

	const body = await event.request.json();

	const unknown = rejectUnknownFields(body, TOPIC_FIELDS);
	if (unknown) return unknown;

	if (body.name === undefined) {
		const [record] = db
			.select({ id: topic.id, name: topic.name, courseId: topic.courseId })
			.from(topic)
			.where(eq(topic.id, event.params.id))
			.all();
		return json(record);
	}

	const name = validateString(body.name, 'name', MAX_NAME_LENGTH);
	if (name instanceof Response) return name;

	try {
		const updated = renameTopic(db, { id: event.params.id, name });
		if (!updated) return json({ error: 'Topic not found.' }, { status: 404 });
		return json({ id: updated.id, name: updated.name, courseId: updated.courseId });
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

	const result = deleteTopic(db, event.params.id, {
		today: today(),
		dir: attachmentsDir(DATABASE_URL)
	});

	if (!result.ok) {
		if (result.reason === 'not found') {
			return json({ error: 'Topic not found.' }, { status: 404 });
		}
		return json({ error: result.reason }, { status: 409 });
	}

	return new Response(null, { status: 204 });
};
