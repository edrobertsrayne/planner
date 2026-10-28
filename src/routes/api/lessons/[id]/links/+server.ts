import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { lesson } from '$lib/server/db/schema';
import { apiRoute, readJson, requireExisting, stringField } from '$lib/server/api-helpers';
import { linksOf, createLink } from '$lib/server/planner';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = apiRoute(async (event) => {
	requireExisting(db, lesson, event.params.id, 'Lesson not found.');

	return json(linksOf(db, event.params.id));
});

export const POST: RequestHandler = apiRoute(async (event) => {
	const data = await readJson(event.request);
	const url = stringField(data.url, 'url');
	const label = stringField(data.label, 'label');

	const created = createLink(db, { lessonId: event.params.id, url, label });
	return json(created, { status: 201 });
});
