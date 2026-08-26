import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { link } from '$lib/server/db/schema';
import { requireApiKey } from '$lib/server/api-key';
import { rejectUnknownFields, validateUrl, validateString } from '$lib/server/api-helpers';
import { deleteLink } from '$lib/server/planner/authoring';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const LINK_FIELDS = new Set(['url', 'label']);

export const PATCH: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const data = await event.request.json();

	const unknown = rejectUnknownFields(data, LINK_FIELDS);
	if (unknown) return unknown;

	const update: Record<string, string> = {};

	if (data.url !== undefined) {
		const url = validateUrl(data.url);
		if (url instanceof Response) return url;
		update.url = url;
	}

	if (data.label !== undefined) {
		const label = validateString(data.label, 'label', 200);
		if (label instanceof Response) return label;
		update.label = label;
	}

	const [existing] = db.select({ id: link.id }).from(link).where(eq(link.id, event.params.id)).all();
	if (!existing) return json({ error: 'Link not found.' }, { status: 404 });

	db.update(link).set(update).where(eq(link.id, event.params.id)).run();

	const [updated] = db.select().from(link).where(eq(link.id, event.params.id)).all();
	return json(updated);
};

export const DELETE: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const result = deleteLink(db, { id: event.params.id });
	if (!result) return json({ error: 'Link not found.' }, { status: 404 });

	return new Response(null, { status: 204 });
};