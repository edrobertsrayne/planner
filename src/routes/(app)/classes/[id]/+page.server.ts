import { fail, redirect } from '@sveltejs/kit';
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { refusal, trimmed } from '$lib/server/form';
import {
	academicYearStart,
	deleteClass,
	activeSlots,
	assignTopic,
	classDetail,
	datedSlotsOf,
	listClasses,
	addLesson,
	moveLessons,
	removeFromSequence,
	renameClass,
	reportOf,
	setSlotRoom,
	sequenceView,
	toggleSlot
} from '$lib/server/planner';
import {
	addedLine,
	assignLines,
	changeLine,
	removedLine,
	type SequenceResult
} from '$lib/sequence-text';
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
		const week = trimmed(data, 'week');
		const day = Number(data.get('day'));
		const period = Number(data.get('period'));
		// The grid always sends the date it is showing. Without one there is no safe edit: ending a
		// Slot from the start of the year would delete it, and its Placements and Blocked Slots
		// would stop the delete.
		const from = trimmed(data, 'from');
		if (!from) return fail(400, { error: 'Choose a date to change the Timetable.' });

		try {
			const toggled = toggleSlot(db, { classId, week, day, period, from, today: today() });
			return { report: toggled && reportOf(toggled) };
		} catch (error) {
			return refusal(error);
		}
	},

	deleteClass: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const result = deleteClass(db, {
			id,
			today: today(),
			confirmed: trimmed(data, 'confirmed') === 'true'
		});
		if (!result) return fail(404, { error: 'No such Class.' });
		if ('needsConfirm' in result) return fail(409, { error: result.reason, needsConfirm: true });
		redirect(303, '/classes');
	},

	assignTopic: async ({ request }) => {
		const data = await request.formData();
		const classId = trimmed(data, 'classId');
		const topicId = trimmed(data, 'topicId');
		try {
			const result = assignTopic(db, { classId, topicId, today: today() });
			return {
				report: reportOf(result),
				sequenceResult: {
					kind: 'assign',
					lines: assignLines(result),
					changed: [],
					ringed: []
				} satisfies SequenceResult
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
				sequenceResult: {
					kind: 'move',
					lines: [changeLine(result.changed.length)],
					changed: result.changed,
					ringed: lessonIds
				} satisfies SequenceResult
			};
		} catch (error) {
			return refusal(error);
		}
	},

	removeLessons: async ({ request }) => {
		const data = await request.formData();
		const classId = trimmed(data, 'classId');
		const lessonIds = trimmed(data, 'lessonIds').split(',').filter(Boolean);
		try {
			const result = removeFromSequence(db, { classId, lessonIds, today: today() });
			return {
				report: reportOf(result),
				sequenceResult: {
					kind: 'remove',
					lines: [removedLine(lessonIds.length), changeLine(result.changed.length)],
					changed: result.changed,
					ringed: []
				} satisfies SequenceResult
			};
		} catch (error) {
			return refusal(error);
		}
	},

	addLesson: async ({ request }) => {
		const data = await request.formData();
		const classId = trimmed(data, 'classId');
		const afterLessonId = trimmed(data, 'afterLessonId') || null;
		try {
			const result = addLesson(db, {
				classId,
				title: String(data.get('title') ?? ''),
				afterLessonId,
				today: today()
			});
			return {
				report: reportOf(result),
				sequenceResult: {
					kind: 'add',
					lines: [addedLine(result.lesson.title), changeLine(result.changed.length)],
					changed: result.changed,
					ringed: []
				} satisfies SequenceResult
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
