import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { lesson } from '$lib/server/db/schema';
import { requireApiKey } from '$lib/server/api-key';
import { refusalJson, requireExisting, stringField } from '$lib/server/api-helpers';
import { linksOf, createLink } from '$lib/server/planner/authoring';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const missing = requireExisting(db, lesson, event.params.id, 'Lesson not found.');
	if (missing) return missing;

	const links = linksOf(db, event.params.id);
	return json(links);
};

export const POST: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const missing = requireExisting(db, lesson, event.params.id, 'Lesson not found.');
	if (missing) return missing;

	const data = await event.request.json();

	const url = stringField(data.url, 'url');
	if (url instanceof Response) return url;

	const label = stringField(data.label, 'label');
	if (label instanceof Response) return label;

	try {
		const created = createLink(db, { lessonId: event.params.id, url, label });
		return json(created, { status: 201 });
	} catch (error) {
		return refusalJson(error);
	}
};
