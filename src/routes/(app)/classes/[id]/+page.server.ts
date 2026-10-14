import { fail, redirect } from '@sveltejs/kit';
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { refusal, trimmed } from '$lib/server/form';
import {
	academicYearStart,
	activeSlots,
	assignTopic,
	classDetail,
	classLanes,
	classNextSessions,
	datedSlotsOf,
	holderAt,
	listClasses,
	moveLessons,
	takeSlot,
	clearSlot,
	removeFromSequence,
	renameClass,
	reportOf,
	setSlotRoom,
	sequenceView
} from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

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
		// The next five Sessions lead Overview (issue #348), from the same derivation as the
		// Agenda rows.
		nextSessions: classNextSessions(db, { classId: selected.id, today: today(), limit: 5 }),
		yearStart,
		effectiveFrom,
		today: today(),
		on,
		grid: activeSlots(db, on),
		datedSlots: datedSlotsOf(db, selected.id),
		sequence: sequenceView(db, { classId: selected.id, today: today() }),
		// Labels the grid needs for a Slot held by another Class — the grid itself carries only
		// classId (activeSlots' shape is unchanged), so the label is looked up here.
		classes: listClasses(db)
	};
};

export const actions: Actions = {
	renameClass: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const label = String(data.get('label') ?? '');
		try {
			const cls = renameClass(db, { id, label });
			if (!cls) return fail(404, { error: 'No such Class.' });
			return { class: cls };
		} catch (error) {
			return refusal(error);
		}
	},

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
				const taken = takeSlot(db, { classId, week, day, period, from, today: today() });
				return { report: reportOf(taken) };
			} else if (holder.classId === classId) {
				const cleared = clearSlot(db, { classId, week, day, period, from, today: today() });
				return { report: cleared && reportOf(cleared) };
			}
			// Held by another Class: no-op — the grid shows it hatched and unclickable, so this
			// is only reached by a stale click racing an edit made elsewhere.
			return { report: null };
		} catch (error) {
			return refusal(error);
		}
	},

	assignTopic: async ({ request }) => {
		const data = await request.formData();
		const classId = trimmed(data, 'classId');
		const topicId = trimmed(data, 'topicId');
		if (!topicId) return fail(400, { error: 'Pick a Topic to assign.' });
		try {
			const result = assignTopic(db, { classId, topicId, today: today() });
			const topicName = sequenceView(db, { classId, today: today() })?.topics.find(
				(topic) => topic.id === topicId
			)?.name;
			return {
				report: reportOf(result),
				assigned: {
					topicName: topicName ?? '',
					added: result.added.length,
					skipped: result.skipped.map(({ title, reason }) => ({ title, reason }))
				}
			};
		} catch (error) {
			return refusal(error);
		}
	},

	moveLessons: async ({ request }) => {
		const data = await request.formData();
		const classId = trimmed(data, 'classId');
		const targetId = trimmed(data, 'targetId');
		const lessonIds = trimmed(data, 'lessonIds').split(',').filter(Boolean);
		try {
			const result = moveLessons(db, { classId, lessonIds, targetId, today: today() });
			return {
				report: reportOf(result),
				moved: {
					lessonIds,
					changed: result.changed,
					lessonsChanged: result.lessonsChanged
				}
			};
		} catch (error) {
			return refusal(error);
		}
	},

	removeLessons: async ({ request }) => {
		const data = await request.formData();
		const classId = trimmed(data, 'classId');
		const lessonIds = data.getAll('lessonId').map(String);
		if (lessonIds.length === 0) return fail(400, { error: 'Pick a Lesson to remove.' });
		try {
			const result = removeFromSequence(db, { classId, lessonIds, today: today() });
			return {
				report: reportOf(result),
				removed: { count: lessonIds.length, changed: result.lessonsChanged }
			};
		} catch (error) {
			return refusal(error);
		}
	},

	setSlotRoom: async ({ request }) => {
		const data = await request.formData();
		const slot = setSlotRoom(db, { id: trimmed(data, 'id'), room: String(data.get('room') ?? '') });
		if (!slot) return fail(404, { error: 'No such Slot.' });
		return { slot };
	}
};
