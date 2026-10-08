import { fail, redirect } from '@sveltejs/kit';
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { refusal, trimmed } from '$lib/server/form';
import {
	academicYearStart,
	activeSlots,
	assignedTopicsOf,
	assignTopic,
	classDetail,
	classLanes,
	classNextSessions,
	datedSlotsOf,
	holderAt,
	listClasses,
	moveAssignedTopic,
	takeSlot,
	clearSlot,
	renameClass,
	reportOf,
	topicsOf,
	unassignTopic
} from '$lib/server/planner';
import { prototypeLayout, prototypeSequence } from './prototype-sequence.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, url }) => {
	const selected = classDetail(db, params.id);
	if (!selected) redirect(303, '/classes');

	const yearStart = academicYearStart(db);
	const effectiveFrom = url.searchParams.get('from') || null;
	// The default position is today (ADR-0007) — start of year is one named stop the "Timetable
	// as at" control offers, never the fallback, or the grid would default to reading history.
	const on = effectiveFrom ?? today();

	// PROTOTYPE (#372): the Sequence and its layout from the real engine.
	const proto = prototypeSequence(db, selected.id, selected.courseId);
	const protoLayout = prototypeLayout(db, {
		classId: selected.id,
		today: today(),
		lessons: proto.sequence.map((l) => ({ id: l.id, length: l.length }))
	});

	return {
		proto,
		protoLayout,
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
		assignedTopics: assignedTopicsOf(db, selected.id),
		courseTopics: topicsOf(db, selected.courseId),
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
			const report = assignTopic(db, { classId, topicId, today: today() });
			return { report };
		} catch (error) {
			return refusal(error);
		}
	},

	unassignTopic: async ({ request }) => {
		const data = await request.formData();
		const classId = trimmed(data, 'classId');
		const id = trimmed(data, 'id');
		try {
			const report = unassignTopic(db, { classId, id, today: today() });
			return { report };
		} catch (error) {
			return refusal(error);
		}
	},

	moveAssignedTopic: async ({ request }) => {
		const data = await request.formData();
		const classId = trimmed(data, 'classId');
		const id = trimmed(data, 'id');
		const direction = trimmed(data, 'direction');
		if (direction !== 'up' && direction !== 'down') return fail(400, { error: 'Bad direction.' });
		const report = moveAssignedTopic(db, { classId, id, direction, today: today() });
		return { report };
	},

	// PROTOTYPE (#372): lays out a proposed order. Never writes.
	prototypeLayout: async ({ request, params }) => {
		const data = await request.formData();
		const lessons = JSON.parse(String(data.get('lessons'))) as { id: string; length: number }[];
		return { layout: prototypeLayout(db, { classId: params.id, today: today(), lessons }) };
	}
};
