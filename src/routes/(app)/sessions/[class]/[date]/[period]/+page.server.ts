import type { RequestEvent } from '@sveltejs/kit';
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { formAction, found, trimmed } from '$lib/server/form';
import {
	placeLesson,
	recordContinuation,
	removeContinuation,
	removePlacement,
	reportOf,
	sessionDetail,
	writeTeachingNote,
	type Occasion
} from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

// A Session is identified by its occasion — Class, date, Period — never by a row id (ADR-0002),
// and the page's address is that occasion. A Period that is not a whole number names no Session.
function occasionOf(params: { class: string; date: string; period: string }): Occasion | null {
	const period = Number(params.period);
	return Number.isInteger(period) ? { classId: params.class, date: params.date, period } : null;
}

// `detail` is null when the address names no Session: an unknown Class, or no occasion at all.
export const load: PageServerLoad = ({ params }) => {
	const occasion = occasionOf(params);
	return { detail: occasion && sessionDetail(db, { ...occasion, today: today() }) };
};

// One Session write: the occasion comes from the address, the rest from the form, and the seam
// owns every refusal (ADR-0025).
const sessionAction = <Output extends Record<string, unknown>>(
	run: (occasion: Occasion, data: FormData) => Output
) =>
	((event: RequestEvent<{ class: string; date: string; period: string }>) =>
		formAction((data) => run(found(occasionOf(event.params), 'Session'), data))(
			event
		)) satisfies Actions[string];

export const actions = {
	// The note is the Teaching note of the occasion's Lesson (ADR-0026).
	writeNote: sessionAction((occasion, data) => {
		writeTeachingNote(db, {
			...occasion,
			lessonId: trimmed(data, 'lessonId'),
			note: String(data.get('note') ?? '') || null
		});
		return {};
	}),

	// "Needs more time": widens the occasion's Lesson onto the Class's next Available Slot.
	continue: sessionAction((occasion) => ({
		report: recordContinuation(db, { ...occasion, today: today() })
	})),

	// Remove one: undoes one Continuation recorded on this occasion.
	uncontinue: sessionAction((occasion) => ({
		report: removeContinuation(db, { ...occasion, today: today() })
	})),

	// The client never learns a Slot's id: it names the occasion and the seam finds the Slot. A
	// placed Lesson is written in the Lesson editor.
	place: sessionAction((occasion, data) => ({
		report: reportOf(
			placeLesson(db, { ...occasion, title: String(data.get('title') ?? ''), today: today() })
		)
	})),

	unplace: sessionAction((_occasion, data) => ({
		report: found(removePlacement(db, { id: trimmed(data, 'id'), today: today() }), 'Placement')
	}))
} satisfies Actions;
