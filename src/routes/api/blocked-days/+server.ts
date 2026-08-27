import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { blockedDay } from '$lib/server/db/schema';
import { requireApiKey } from '$lib/server/api-key';
import { MAX_NAME_LENGTH, getDateToday } from '$lib/server/api-helpers';
import { blockDay } from '$lib/server/planner';
import { asc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

// A Blocked Day is addressed by date, so the list carries no ids — the date is the address.
export const GET: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const rows = db
		.select({ date: blockedDay.date, note: blockedDay.note })
		.from(blockedDay)
		.orderBy(asc(blockedDay.date))
		.all();

	return json({ blockedDays: rows });
};

// Extra fields in a body are read and ignored: the body carries what it carries. The date rules
// — malformed, weekend, already blocked — live in the seam, which answers 400 or 409 with the
// reason the teacher reads.
export const POST: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const data = await event.request.json();

	if (typeof data.date !== 'string') {
		return json({ error: 'The "date" field is required.' }, { status: 400 });
	}

	let note: string | undefined;
	if (data.note !== undefined && data.note !== null) {
		if (typeof data.note !== 'string') {
			return json({ error: 'The "note" field must be a string.' }, { status: 400 });
		}
		const trimmed = data.note.trim();
		if (trimmed.length > MAX_NAME_LENGTH) {
			return json(
				{ error: `The "note" field must be at most ${MAX_NAME_LENGTH} characters.` },
				{ status: 400 }
			);
		}
		note = trimmed || undefined;
	}

	const report = blockDay(db, { date: data.date, note, today: getDateToday() });
	if (!report.ok) return json({ error: report.reason }, { status: report.status });

	return json(
		{ blockedDay: { date: data.date, note: note ?? null }, atRisk: report.atRisk },
		{ status: 201 }
	);
};
