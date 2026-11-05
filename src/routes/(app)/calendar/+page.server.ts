import { TERM_NAMES } from '$lib/calendar/generate-teaching-weeks';
import { defaultWeek } from '$lib/calendar/default-week';
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { formAction } from '$lib/server/form';
import {
	clearCoverAction,
	setCoverAction,
	blockDayAction,
	blockSlotAction,
	unblockDayAction,
	unblockSlotAction
} from '$lib/server/block-actions';
import { asc } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import { calendarWeek, coverChoices, replaceTerms, teachingWeeks } from '$lib/server/planner';
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

	return {
		selected,
		week,
		ribbon,
		prev,
		next,
		current,
		terms,
		blockedDays,
		coverChoices: coverChoices(db),
		today: today()
	};
};

export const actions: Actions = {
	blockDay: blockDayAction,

	unblockDay: unblockDayAction,

	blockSlot: blockSlotAction,

	unblockSlot: unblockSlotAction,

	setCover: setCoverAction,

	clearCover: clearCoverAction,

	// The whole year, replaced as one document through the Terms seam — the seam owns every
	// rule, so the action validates nothing of its own. The six rows are read in year position,
	// named by the canonical Term names and not this action's own count. The report
	// travels back with the save; an empty one is stated plainly rather than left to read as
	// silence.
	saveYear: formAction((data) => {
		const terms = TERM_NAMES.map((_, i) => ({
			opens: String(data.get(`opens-${i}`) ?? ''),
			closes: String(data.get(`closes-${i}`) ?? '')
		}));

		return { report: replaceTerms(db, { terms, today: today() }), yearSaved: true };
	})
};
