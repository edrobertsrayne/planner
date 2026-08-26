import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { lesson } from '$lib/server/db/schema';
import { requireApiKey } from '$lib/server/api-key';
import { rejectUnknownFields, validateUrl, validateString } from '$lib/server/api-helpers';
import { linksOf, createLink } from '$lib/server/planner/authoring';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const LINK_FIELDS = new Set(['url', 'label']);

export const GET: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const [existing] = db
		.select({ id: lesson.id })
		.from(lesson)
		.where(eq(lesson.id, event.params.id))
		.all();
	if (!existing) return json({ error: 'Lesson not found.' }, { status: 404 });

	const links = linksOf(db, event.params.id);
	return json(links);
};

export const POST: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const [existing] = db
		.select({ id: lesson.id })
		.from(lesson)
		.where(eq(lesson.id, event.params.id))
		.all();
	if (!existing) return json({ error: 'Lesson not found.' }, { status: 404 });

	const data = await event.request.json();

	const unknown = rejectUnknownFields(data, LINK_FIELDS);
	if (unknown) return unknown;

	const url = validateUrl(data.url);
	if (url instanceof Response) return url;

	const label = validateString(data.label, 'label', 200);
	if (label instanceof Response) return label;

	const created = createLink(db, { lessonId: event.params.id, url, label });
	return json(created, { status: 201 });
};
