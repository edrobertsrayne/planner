import { fail } from '@sveltejs/kit';
import { TERM_NAMES } from '$lib/calendar/generate-teaching-weeks';
import { addDays, today } from '$lib/date';
import { client, db } from '$lib/server/db/client';
import { asc } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import {
	blockDay,
	blockSlot,
	calendarWeek,
	replaceTerms,
	teachingWeeks,
	unblockDay,
	unblockSlot
} from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

// The week to open on: the Teaching Week today falls inside, or — during a break, when no
// Teaching Week covers today — the next one to come, or the last of the year once even that has
// run out.
function defaultWeek(weeks: { weekCommencing: string }[], on: string): string | null {
	if (weeks.length === 0) return null;
	const containing = weeks.find(
		(w) => on >= w.weekCommencing && on <= addDays(w.weekCommencing, 4)
	);
	if (containing) return containing.weekCommencing;
	const upcoming = weeks.find((w) => w.weekCommencing > on);
	if (upcoming) return upcoming.weekCommencing;
	return weeks[weeks.length - 1].weekCommencing;
}

const RIBBON_RADIUS = 3;

export const load: PageServerLoad = ({ url }) => {
	const weeks = teachingWeeks(db);
	const requested = url.searchParams.get('week');
	const selected =
		(requested && weeks.some((w) => w.weekCommencing === requested) ? requested : null) ??
		defaultWeek(weeks, today());

	const week = selected ? calendarWeek(db, { weekCommencing: selected, today: today() }) : null;

	const index = selected ? weeks.findIndex((w) => w.weekCommencing === selected) : -1;
	const ribbon =
		index < 0 ? [] : weeks.slice(Math.max(0, index - RIBBON_RADIUS), index + RIBBON_RADIUS + 1);
	const prev = index > 0 ? weeks[index - 1].weekCommencing : null;
	const next = index >= 0 && index < weeks.length - 1 ? weeks[index + 1].weekCommencing : null;

	// The setup mode edits the year in place: the six Terms as they stand, in date order so the
	// rows read in year position, and every Blocked Day with its note — the whole-year list the
	// mode shows, and what trims the preview's day counts.
	const terms = db
		.select({ opens: schema.term.opens, closes: schema.term.closes })
		.from(schema.term)
		.orderBy(asc(schema.term.opens))
		.all();
	const blockedDays = db
		.select({ date: schema.blockedDay.date, note: schema.blockedDay.note })
		.from(schema.blockedDay)
		.orderBy(asc(schema.blockedDay.date))
		.all();

	return { selected, week, ribbon, prev, next, today: today(), terms, blockedDays };
};

export const actions: Actions = {
	blockDay: async ({ request }) => {
		const data = await request.formData();
		const date = String(data.get('date') ?? '');
		const note = String(data.get('note') ?? '').trim();
		if (!date) return fail(400, { error: 'No date given.' });

		const report = blockDay(db, { date, note: note || undefined, today: today() });
		if (!report.ok) return fail(report.status, { error: report.reason });
		return { atRisk: report.atRisk };
	},

	unblockDay: async ({ request }) => {
		const data = await request.formData();
		const date = String(data.get('date') ?? '');

		const report = unblockDay(db, { date, today: today() });
		if (!report) return fail(400, { error: 'No such Blocked Day.' });
		return { atRisk: report.atRisk };
	},

	blockSlot: async ({ request }) => {
		const data = await request.formData();
		const classId = String(data.get('classId') ?? '');
		const date = String(data.get('date') ?? '');
		const slotId = String(data.get('slotId') ?? '');
		const note = String(data.get('note') ?? '').trim();
		if (!classId || !date || !slotId) return fail(400, { error: 'Missing Slot to block.' });
		if (!note) return fail(400, { error: 'A Blocked Slot needs a note.' });

		const report = blockSlot(db, { classId, date, slotId, note, today: today() });
		return { atRisk: report.atRisk };
	},

	unblockSlot: async ({ request }) => {
		const data = await request.formData();
		const id = String(data.get('id') ?? '');

		const report = unblockSlot(db, { id, today: today() });
		if (!report) return fail(400, { error: 'No such Blocked Slot.' });
		return { atRisk: report.atRisk };
	},

	// The whole year, replaced as one document through the Terms seam — the seam owns every
	// rule, so the action validates nothing of its own. The six rows are read in year position,
	// named by the canonical Term names and not this action's own count. The at-risk report
	// travels back with the save; an empty one is stated plainly rather than left to read as
	// silence.
	saveYear: async ({ request }) => {
		const data = await request.formData();
		const terms = TERM_NAMES.map((_, i) => ({
			opens: String(data.get(`opens-${i}`) ?? ''),
			closes: String(data.get(`closes-${i}`) ?? '')
		}));

		const result = replaceTerms(db, client, { terms, today: today() });
		if (!result.ok) return fail(400, { error: result.reason });
		return { atRisk: result.atRisk, yearSaved: true };
	}
};
