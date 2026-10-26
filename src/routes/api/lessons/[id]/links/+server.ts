import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { lesson } from '$lib/server/db/schema';
import { readJson, refusalJson, requireExisting, stringField } from '$lib/server/api-helpers';
import { linksOf, createLink } from '$lib/server/planner';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const missing = requireExisting(db, lesson, event.params.id, 'Lesson not found.');
	if (missing) return missing;

	return json(linksOf(db, event.params.id));
};

export const POST: RequestHandler = async (event) => {
	// `createLink` does not check its Lesson, so the route does, before reading the body.
	const missing = requireExisting(db, lesson, event.params.id, 'Lesson not found.');
	if (missing) return missing;

	const data = await readJson(event.request);
	if (data instanceof Response) return data;

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
