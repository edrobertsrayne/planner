import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { term } from '$lib/server/db/schema';
import { requireApiKey } from '$lib/server/api-key';
import { today } from '$lib/date';
import { jsonObject, readJson, refusalJson } from '$lib/server/api-helpers';
import { replaceTerms } from '$lib/server/planner';
import { TERM_NAMES } from '$lib/calendar/generate-teaching-weeks';
import { asc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

// The GET shape: the six in date order, names derived from position, and no ids — a Term is
// never addressed on its own, only replaced as one document.
function termsInYearOrder() {
	const rows = db
		.select({ opens: term.opens, closes: term.closes })
		.from(term)
		.orderBy(asc(term.opens))
		.all();
	return rows.map((row, position) => ({ ...row, name: TERM_NAMES[position] }));
}

export const GET: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	return json({ terms: termsInYearOrder() });
};

// The six replaced as one document through the seam — no value rule lives here. Extra fields in
// a request body are read and ignored; the app never sends them. The door checks only that each
// element is an object, because the seam reads `opens` and `closes` off every one of them.
export const PUT: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const data = await readJson(event.request);
	if (data instanceof Response) return data;

	const terms = Array.isArray(data.terms) ? data.terms : [];
	if (terms.some((term) => !jsonObject(term))) {
		return json({ error: 'The "terms" field must be an array of Term objects.' }, { status: 400 });
	}

	try {
		const report = replaceTerms(db, { terms, today: today() });
		return json({ terms: termsInYearOrder(), report });
	} catch (error) {
		return refusalJson(error);
	}
};
