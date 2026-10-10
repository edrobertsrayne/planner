import { fail } from '@sveltejs/kit';
import { TERM_NAMES } from '$lib/calendar/generate-teaching-weeks';
import { today } from '$lib/date';
import { client, db } from '$lib/server/db/client';
import { refusal } from '$lib/server/form';
import { asc } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import {
	blockDay,
	blockSlot,
	calendarWeek,
	defaultWeek,
	replaceTerms,
	teachingWeeks,
	unblockDay,
	unblockSlot
} from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

// The ribbon shows the selected week and two Teaching Weeks either side (issue #293).
const RIBBON_RADIUS = 2;

export const load: PageServerLoad = ({ url }) => {
	const weeks = teachingWeeks(db);
	const current = defaultWeek(weeks, today());
	const requested = url.searchParams.get('week');
	const selected =
		(requested && weeks.some((w) => w.weekCommencing === requested) ? requested : null) ?? current;

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

	return { selected, week, ribbon, prev, next, current, terms, blockedDays, today: today() };
};

export const actions: Actions = {
	blockDay: async ({ request }) => {
		const data = await request.formData();
		const date = String(data.get('date') ?? '');
		const note = String(data.get('note') ?? '');
		if (!date) return fail(400, { error: 'No date given.' });

		try {
			const report = blockDay(db, { date, note, today: today() });
			return { report };
		} catch (error) {
			return refusal(error);
		}
	},

	unblockDay: async ({ request }) => {
		const data = await request.formData();
		const date = String(data.get('date') ?? '');

		const report = unblockDay(db, { date, today: today() });
		if (!report) return fail(400, { error: 'No such Blocked Day.' });
		return { report };
	},

	blockSlot: async ({ request }) => {
		const data = await request.formData();
		const classId = String(data.get('classId') ?? '');
		const date = String(data.get('date') ?? '');
		const slotId = String(data.get('slotId') ?? '');
		const note = String(data.get('note') ?? '');
		if (!classId || !date || !slotId) return fail(400, { error: 'Missing Slot to block.' });

		try {
			const report = blockSlot(db, { classId, date, slotId, note, today: today() });
			return { report };
		} catch (error) {
			return refusal(error);
		}
	},

	unblockSlot: async ({ request }) => {
		const data = await request.formData();
		const id = String(data.get('id') ?? '');

		const report = unblockSlot(db, { id, today: today() });
		if (!report) return fail(400, { error: 'No such Blocked Slot.' });
		return { report };
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

		try {
			const report = replaceTerms(db, client, { terms, today: today() });
			return { report, yearSaved: true };
		} catch (error) {
			return refusal(error);
		}
	}
};
