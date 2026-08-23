import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	addDays,
	blockDay,
	blockSlot,
	calendarWeek,
	describeAtRisk,
	setTeachingWeekLetter,
	teachingWeeksList,
	unblockDay,
	unblockSlot
} from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

function today() {
	return new Date().toISOString().slice(0, 10);
}

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
	const weeks = teachingWeeksList(db);
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

	return { selected, week, ribbon, prev, next, today: today() };
};

export const actions: Actions = {
	setLetter: async ({ request }) => {
		const data = await request.formData();
		const weekCommencing = String(data.get('weekCommencing') ?? '');
		const letter = String(data.get('letter') ?? '');
		if (letter !== 'A' && letter !== 'B') return fail(400, { error: 'Bad Week letter.' });

		const report = setTeachingWeekLetter(db, { weekCommencing, letter, today: today() });
		if (!report) return fail(400, { error: 'No such Teaching Week.' });
		return { atRisk: describeAtRisk(db, report.atRisk) };
	},

	blockDay: async ({ request }) => {
		const data = await request.formData();
		const date = String(data.get('date') ?? '');
		const note = String(data.get('note') ?? '').trim();
		if (!date) return fail(400, { error: 'No date given.' });

		const report = blockDay(db, { date, note: note || undefined, today: today() });
		return { atRisk: describeAtRisk(db, report.atRisk) };
	},

	unblockDay: async ({ request }) => {
		const data = await request.formData();
		const id = String(data.get('id') ?? '');

		const report = unblockDay(db, { id, today: today() });
		if (!report) return fail(400, { error: 'No such Blocked Day.' });
		return { atRisk: describeAtRisk(db, report.atRisk) };
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
		return { atRisk: describeAtRisk(db, report.atRisk) };
	},

	unblockSlot: async ({ request }) => {
		const data = await request.formData();
		const id = String(data.get('id') ?? '');

		const report = unblockSlot(db, { id, today: today() });
		if (!report) return fail(400, { error: 'No such Blocked Slot.' });
		return { atRisk: describeAtRisk(db, report.atRisk) };
	}
};
