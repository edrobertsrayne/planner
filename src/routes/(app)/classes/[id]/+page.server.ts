import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import {
	academicYearStart,
	activeSlots,
	assignedTopicsOf,
	assignTopic,
	classDetail,
	classLanes,
	datedSlotsOf,
	holderAt,
	listClasses,
	moveAssignedTopic,
	takeSlot,
	clearSlot,
	topicsOf,
	unassignTopic
} from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

// The scheduling boundary: a Timetable change re-derives the Class from today, never before.
function today() {
	return new Date().toISOString().slice(0, 10);
}

function trimmed(data: FormData, field: string) {
	return String(data.get(field) ?? '').trim();
}

export const load: PageServerLoad = ({ params, url }) => {
	const selected = classDetail(db, params.id);
	if (!selected) redirect(303, '/classes');

	const yearStart = academicYearStart(db);
	const effectiveFrom = url.searchParams.get('from') || null;
	// The default position is today (ADR-0007) — start of year is one named stop the "Timetable
	// as at" control offers, never the fallback, or the grid would default to reading history.
	const on = effectiveFrom ?? today();

	return {
		class: selected,
		lane: classLanes(db, { today: today(), classId: selected.id })[0] ?? null,
		yearStart,
		effectiveFrom,
		today: today(),
		on,
		grid: activeSlots(db, on),
		datedSlots: datedSlotsOf(db, selected.id),
		assignedTopics: assignedTopicsOf(db, selected.id),
		courseTopics: topicsOf(db, selected.courseId),
		// Labels the grid needs for a Slot held by another Class — the grid itself carries only
		// classId (activeSlots' shape is unchanged), so the label is looked up here.
		classes: listClasses(db)
	};
};

export const actions: Actions = {
	toggleSlot: async ({ request }) => {
		const data = await request.formData();
		const classId = trimmed(data, 'classId');
		const week = trimmed(data, 'week') as 'A' | 'B';
		const day = Number(data.get('day'));
		const period = Number(data.get('period'));
		const from = trimmed(data, 'from') || null;
		const on = from ?? today();

		const holder = holderAt(db, { week, day, period, on });
		try {
			if (!holder) {
				takeSlot(db, { classId, week, day, period, from, today: today() });
			} else if (holder.classId === classId) {
				clearSlot(db, { classId, week, day, period, from, today: today() });
			}
			// Held by another Class: no-op — the grid shows it hatched and unclickable, so this
			// is only reached by a stale click racing an edit made elsewhere.
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Could not change the Timetable.'
			});
		}
	},

	assignTopic: async ({ request }) => {
		const data = await request.formData();
		const classId = trimmed(data, 'classId');
		const topicId = trimmed(data, 'topicId');
		if (!topicId) return fail(400, { error: 'Pick a Topic to assign.' });
		try {
			assignTopic(db, { classId, topicId, today: today() });
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Could not assign the Topic.'
			});
		}
	},

	unassignTopic: async ({ request }) => {
		const data = await request.formData();
		const classId = trimmed(data, 'classId');
		const id = trimmed(data, 'id');
		try {
			unassignTopic(db, { classId, id, today: today() });
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Could not unassign the Topic.'
			});
		}
	},

	moveAssignedTopic: async ({ request }) => {
		const data = await request.formData();
		const classId = trimmed(data, 'classId');
		const id = trimmed(data, 'id');
		const direction = trimmed(data, 'direction');
		if (direction !== 'up' && direction !== 'down') return fail(400, { error: 'Bad direction.' });
		moveAssignedTopic(db, { classId, id, direction, today: today() });
	}
};
