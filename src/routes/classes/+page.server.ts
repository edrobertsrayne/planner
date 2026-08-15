import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	academicYearStart,
	activeSlots,
	classDetail,
	createClass,
	datedSlotsOf,
	holderAt,
	listClasses,
	listCourses,
	takeSlot,
	clearSlot
} from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

// The scheduling boundary: a Timetable change re-derives the Class from today, never before.
function today() {
	return new Date().toISOString().slice(0, 10);
}

function trimmed(data: FormData, field: string) {
	return String(data.get(field) ?? '').trim();
}

export const load: PageServerLoad = ({ url }) => {
	const courses = listCourses(db);
	const classes = listClasses(db);

	const classId = url.searchParams.get('class') ?? classes[0]?.id ?? null;
	const selected = classId ? classDetail(db, classId) : null;

	const yearStart = academicYearStart(db);
	const effectiveFrom = url.searchParams.get('from') || null;
	const on = effectiveFrom ?? yearStart ?? today();

	const grid = selected ? activeSlots(db, on) : [];
	const datedSlots = selected ? datedSlotsOf(db, selected.id) : [];

	return { courses, classes, class: selected, yearStart, effectiveFrom, on, grid, datedSlots };
};

export const actions: Actions = {
	createClass: async ({ request }) => {
		const data = await request.formData();
		const label = trimmed(data, 'label');
		const courseId = trimmed(data, 'courseId');
		if (!label) return fail(400, { error: 'A Class needs a label.' });
		if (!courseId) return fail(400, { error: 'A Class needs a Course.' });
		return { class: createClass(db, { label, courseId }) };
	},

	toggleSlot: async ({ request }) => {
		const data = await request.formData();
		const classId = trimmed(data, 'classId');
		const week = trimmed(data, 'week') as 'A' | 'B';
		const day = Number(data.get('day'));
		const period = Number(data.get('period'));
		const from = trimmed(data, 'from') || null;
		const on = from ?? academicYearStart(db) ?? today();

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
		return {};
	}
};
