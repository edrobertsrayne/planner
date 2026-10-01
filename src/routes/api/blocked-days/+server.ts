import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { blockedDay } from '$lib/server/db/schema';
import { requireApiKey } from '$lib/server/api-key';
import { today } from '$lib/date';
import { refusalJson } from '$lib/server/api-helpers';
import { blockDay } from '$lib/server/planner';
import { asc, eq } from 'drizzle-orm';
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
// — malformed, weekend, already blocked — and the note's trim live in the seam, which throws
// `Refused` and this door answers 400 or 409 with the reason the teacher reads.
export const POST: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const data = await event.request.json();

	if (typeof data.date !== 'string') {
		return json({ error: 'The "date" field is required.' }, { status: 400 });
	}

	if (data.note !== undefined && data.note !== null && typeof data.note !== 'string') {
		return json({ error: 'The "note" field must be a string.' }, { status: 400 });
	}

	try {
		const report = blockDay(db, { date: data.date, note: data.note ?? undefined, today: today() });
		const [stored] = db
			.select({ date: blockedDay.date, note: blockedDay.note })
			.from(blockedDay)
			.where(eq(blockedDay.date, data.date))
			.all();
		return json(
			{
				blockedDay: stored,
				atRisk: report.atRisk,
				placementsMoved: report.placementsMoved
			},
			{ status: 201 }
		);
	} catch (error) {
		return refusalJson(error);
	}
};
