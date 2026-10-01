import { json } from '@sveltejs/kit';
import { today } from '$lib/date';
import { DATABASE_URL, db } from '$lib/server/db/client';
import { topic } from '$lib/server/db/schema';
import { requireApiKey } from '$lib/server/api-key';
import { refusalJson, requireExisting, stringField } from '$lib/server/api-helpers';
import { renameTopic, deleteTopic, attachmentsDir } from '$lib/server/planner';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

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

	if (body.name === undefined) {
		const [record] = db
			.select({ id: topic.id, name: topic.name, courseId: topic.courseId })
			.from(topic)
			.where(eq(topic.id, event.params.id))
			.all();
		return json(record);
	}

	const name = stringField(body.name, 'name');
	if (name instanceof Response) return name;

	try {
		const updated = renameTopic(db, { id: event.params.id, name });
		if (!updated) return json({ error: 'Topic not found.' }, { status: 404 });
		return json({ id: updated.id, name: updated.name, courseId: updated.courseId });
	} catch (error) {
		return refusalJson(error);
	}
};

export const DELETE: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	try {
		const result = deleteTopic(db, event.params.id, {
			today: today(),
			dir: attachmentsDir(DATABASE_URL)
		});

		// An unknown id is a URL miss — the route's own 404, not the seam's. The confirm question
		// is the one failure that is not a refusal; the API never confirms, so it stays a 409.
		if (!result) return json({ error: 'Topic not found.' }, { status: 404 });
		if ('needsConfirm' in result) return json({ error: result.reason }, { status: 409 });

		return new Response(null, { status: 204 });
	} catch (error) {
		return refusalJson(error);
	}
};
