import { redirect } from '@sveltejs/kit';
import { addDays, today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { formAction, found, trimmed } from '$lib/server/form';
import {
	academicYearStart,
	activeEventSlots,
	activeSlots,
	deleteEvent,
	eventOccurrences,
	eventSlotsOf,
	findEvent,
	listClasses,
	Refused,
	renameEvent,
	setEventNote,
	setEventSlotRoom,
	toggleEventSlot
} from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

// How far either side of today the Notes tab lists dates: eight weeks back to log, sixteen ahead to
// plan. A date the link names beyond that widens the window to take it in.
const LOOK_BACK_DAYS = 56;
const LOOK_AHEAD_DAYS = 112;

export const load: PageServerLoad = ({ params, url }) => {
	const event = findEvent(db, params.id);
	if (!event) redirect(303, '/events');

	const now = today();
	const date = url.searchParams.get('date') || null;
	const from = [addDays(now, -LOOK_BACK_DAYS), date].filter((d): d is string => !!d).sort()[0];
	const to = [addDays(now, LOOK_AHEAD_DAYS), date]
		.filter((d): d is string => !!d)
		.sort()
		.at(-1)!;

	// "Timetable as at" works as on the Class page: today unless the link names a date.
	const effectiveFrom = url.searchParams.get('from') || null;
	const on = effectiveFrom ?? now;

	const everySlot = eventSlotsOf(db, event.id);
	const asked = url.searchParams.get('tab');

	return {
		event,
		today: now,
		date,
		// An Event with no Slot has no dates to write on, so it opens on the Timetable to be placed.
		tab:
			asked === 'timetable' || (asked !== 'notes' && everySlot.length === 0)
				? ('timetable' as const)
				: ('notes' as const),
		occurrences: eventOccurrences(db, { eventId: event.id, from, to }),
		on,
		yearStart: academicYearStart(db),
		classSlots: activeSlots(db, on),
		eventSlots: activeEventSlots(db, on),
		datedSlots: eventSlotsOf(db, event.id).filter(
			(s) => s.holdsFrom !== null || s.holdsTo !== null
		),
		classes: listClasses(db)
	};
};

export const actions: Actions = {
	renameEvent: formAction((data) => ({
		event: found(
			renameEvent(db, { id: trimmed(data, 'id'), name: String(data.get('name') ?? '') }),
			'Event'
		)
	})),

	deleteEvent: formAction((data) => {
		found(
			deleteEvent(db, {
				id: trimmed(data, 'id'),
				confirmed: trimmed(data, 'confirmed') === 'true'
			}),
			'Event'
		);
		redirect(303, '/events');
	}),

	toggleEventSlot: formAction((data) => {
		// As on the Class page: without a date there is no safe edit.
		const from = trimmed(data, 'from');
		if (!from) throw new Refused('invalid', 'Choose a date to change the Timetable.');
		toggleEventSlot(db, {
			eventId: trimmed(data, 'eventId'),
			week: trimmed(data, 'week'),
			day: Number(data.get('day')),
			position: Number(data.get('position')),
			from
		});
	}),

	setEventSlotRoom: formAction((data) => ({
		slot: found(
			setEventSlotRoom(db, { id: trimmed(data, 'id'), room: String(data.get('room') ?? '') }),
			'Event Slot'
		)
	})),

	setEventNote: formAction((data) => {
		setEventNote(db, {
			eventId: trimmed(data, 'eventId'),
			date: trimmed(data, 'date'),
			note: String(data.get('note') ?? '')
		});
	})
};
