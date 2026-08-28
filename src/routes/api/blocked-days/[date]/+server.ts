import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { requireApiKey } from '$lib/server/api-key';
import { getDateToday } from '$lib/server/api-helpers';
import { unblockDay } from '$lib/server/planner';
import type { RequestHandler } from './$types';

// 200 rather than 204: the body carries the Rewind's at-risk report. A date that is not blocked
// is a 404 — the address names the record, and this one does not exist.
export const DELETE: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const report = unblockDay(db, { date: event.params.date, today: getDateToday() });
	if (!report) return json({ error: 'No such Blocked Day.' }, { status: 404 });

	return json({ atRisk: report.atRisk });
};
