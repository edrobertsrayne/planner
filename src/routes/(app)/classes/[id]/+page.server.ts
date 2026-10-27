import { redirect } from '@sveltejs/kit';
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { formAction, found, trimmed } from '$lib/server/form';
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
	Refused,
	setSlotRoom,
	sequenceView,
	toggleSlot
} from '$lib/server/planner';
import {
	addedLine,
	assignLines,
	changeLine,
	removedLine,
	sequenceAnswer
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
	renameClass: formAction((data) => ({
		class: found(
			renameClass(db, { id: trimmed(data, 'id'), label: String(data.get('label') ?? '') }),
			'Class'
		)
	})),

	toggleSlot: formAction((data) => {
		const classId = trimmed(data, 'classId');
		const week = trimmed(data, 'week');
		const day = Number(data.get('day'));
		const period = Number(data.get('period'));
		// The grid always sends the date it is showing. Without one there is no safe edit: ending a
		// Slot from the start of the year would delete it, and its Placements and Blocked Slots
		// would stop the delete.
		const from = trimmed(data, 'from');
		if (!from) throw new Refused('invalid', 'Choose a date to change the Timetable.');

		const toggled = toggleSlot(db, { classId, week, day, period, from, today: today() });
		return { report: toggled && reportOf(toggled) };
	}),

	deleteClass: formAction((data) => {
		found(
			deleteClass(db, {
				id: trimmed(data, 'id'),
				today: today(),
				confirmed: trimmed(data, 'confirmed') === 'true'
			}),
			'Class'
		);
		redirect(303, '/classes');
	}),

	assignTopic: formAction((data) => {
		const result = assignTopic(db, {
			classId: trimmed(data, 'classId'),
			topicId: trimmed(data, 'topicId'),
			today: today()
		});
		return sequenceAnswer('assign', {
			report: reportOf(result),
			changed: result.changed,
			lines: assignLines(result)
		});
	}),

	moveLessons: formAction((data) => {
		const lessonIds = trimmed(data, 'lessonIds').split(',').filter(Boolean);
		const result = moveLessons(db, {
			classId: trimmed(data, 'classId'),
			lessonIds,
			targetId: trimmed(data, 'targetId'),
			today: today()
		});
		return sequenceAnswer('move', {
			report: reportOf(result),
			changed: result.changed,
			lines: [changeLine(result.changed.length)],
			ringed: lessonIds
		});
	}),

	removeLessons: formAction((data) => {
		const lessonIds = trimmed(data, 'lessonIds').split(',').filter(Boolean);
		const result = removeFromSequence(db, {
			classId: trimmed(data, 'classId'),
			lessonIds,
			today: today()
		});
		return sequenceAnswer('remove', {
			report: reportOf(result),
			changed: result.changed,
			lines: [removedLine(lessonIds.length), changeLine(result.changed.length)]
		});
	}),

	addLesson: formAction((data) => {
		const result = addLesson(db, {
			classId: trimmed(data, 'classId'),
			title: String(data.get('title') ?? ''),
			afterLessonId: trimmed(data, 'afterLessonId') || null,
			today: today()
		});
		return sequenceAnswer('add', {
			report: reportOf(result),
			changed: result.changed,
			lines: [addedLine(result.lesson.title), changeLine(result.changed.length)]
		});
	}),

	setSlotRoom: formAction((data) => ({
		slot: found(
			setSlotRoom(db, { id: trimmed(data, 'id'), room: String(data.get('room') ?? '') }),
			'Slot'
		)
	}))
};
