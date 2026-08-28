import { json } from '@sveltejs/kit';
import { db, client } from '$lib/server/db/client';
import { term } from '$lib/server/db/schema';
import { requireApiKey } from '$lib/server/api-key';
import { getDateToday } from '$lib/server/api-helpers';
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

// The six replaced as one document through the seam — no validation lives here. Extra fields in
// a request body are read and ignored; the app never sends them.
export const PUT: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const data = await event.request.json();
	const terms = Array.isArray(data.terms) ? data.terms : [];

	const result = replaceTerms(db, client, { terms, today: getDateToday() });
	if (!result.ok) return json({ error: result.reason }, { status: 400 });

	return json({ terms: termsInYearOrder(), atRisk: result.atRisk });
};
