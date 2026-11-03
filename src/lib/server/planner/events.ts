// Events: recurring commitments of the teacher's own that are not Classes (ADR-0029). An Event
// holds Event Slots, and an Event Slot never shares a position with a Class's Slot, so an Event
// is never an input to the schedule and nothing here re-derives a Class.
import { and, eq } from 'drizzle-orm';
import { addDays } from '$lib/date';
import * as schema from '../db/schema';
import { inTransaction } from '../db';
import type { Db } from './derive';
import { inAnyTerm, slotHolds } from './engine';
import { loadCalendar } from './derive';
import {
	eventKind,
	eventPosition,
	lessonBody,
	required,
	requireRow,
	slotDay,
	slotWeek
} from './fields';
import { Refused } from './refused';
import { overlaps, positionName } from './timetable';

const MIN_DATE = '0000-01-01';

export function createEvent(db: Db, { name, kind }: { name: string; kind: string }) {
	const [row] = db
		.insert(schema.event)
		.values({ name: required(name, 'An Event needs a name.'), kind: eventKind(kind) })
		.returning()
		.all();
	return row;
}

// Puts an Event in a Timetable position from a chosen date, or from the start of the year when
// `from` is null. The position must be free of every Class's Slot and every other Event's Slot
// over the dates the new Event Slot would hold (ADR-0029); the refusal names the holder.
export function takeEventSlot(
	db: Db,
	input: {
		eventId: string;
		week: string;
		day: number;
		position: number;
		from: string | null;
	}
) {
	const week = slotWeek(input.week);
	const day = slotDay(input.day);
	const position = eventPosition(input.position);
	requireRow(db, schema.event, input.eventId, 'Event not found.');
	const window = { holdsFrom: input.from, holdsTo: null };
	const where = (name: string) =>
		new Refused(
			'conflict',
			`${positionName(week, day, position)} already belongs to ${name} over these dates.`
		);

	const heldByClass = db
		.select({
			label: schema.classes.label,
			holdsFrom: schema.slot.holdsFrom,
			holdsTo: schema.slot.holdsTo
		})
		.from(schema.slot)
		.innerJoin(schema.classes, eq(schema.classes.id, schema.slot.classId))
		.where(
			and(eq(schema.slot.week, week), eq(schema.slot.day, day), eq(schema.slot.period, position))
		)
		.all()
		.find((s) => overlaps(window, s));
	if (heldByClass) throw where(heldByClass.label);

	const heldByEvent = db
		.select({
			name: schema.event.name,
			holdsFrom: schema.eventSlot.holdsFrom,
			holdsTo: schema.eventSlot.holdsTo
		})
		.from(schema.eventSlot)
		.innerJoin(schema.event, eq(schema.event.id, schema.eventSlot.eventId))
		.where(
			and(
				eq(schema.eventSlot.week, week),
				eq(schema.eventSlot.day, day),
				eq(schema.eventSlot.position, position)
			)
		)
		.all()
		.find((s) => overlaps(window, s));
	if (heldByEvent) throw where(heldByEvent.name);

	const [slot] = db
		.insert(schema.eventSlot)
		.values({ eventId: input.eventId, week, day, position, holdsFrom: input.from })
		.returning()
		.all();
	return { slot };
}

// Every Event Slot holding on one date, with its Event's name and kind: what the Calendar, the
// Agenda and a Class's grid read to know which positions an Event has taken.
export function activeEventSlots(db: Db, on: string) {
	return db
		.select({
			id: schema.eventSlot.id,
			eventId: schema.eventSlot.eventId,
			name: schema.event.name,
			kind: schema.event.kind,
			week: schema.eventSlot.week,
			day: schema.eventSlot.day,
			position: schema.eventSlot.position,
			holdsFrom: schema.eventSlot.holdsFrom,
			holdsTo: schema.eventSlot.holdsTo,
			room: schema.eventSlot.room
		})
		.from(schema.eventSlot)
		.innerJoin(schema.event, eq(schema.event.id, schema.eventSlot.eventId))
		.all()
		.filter((s) => slotHolds(s, on));
}

// Ends an Event Slot from a chosen date: the day before if it already held earlier, or removed
// outright if it never held before that date. Nothing is re-derived, because an Event is not an
// input to the schedule (ADR-0029), and notes already written for earlier dates are untouched.
function endEventSlot(db: Db, row: typeof schema.eventSlot.$inferSelect, endFrom: string) {
	if ((row.holdsFrom ?? MIN_DATE) >= endFrom) {
		db.delete(schema.eventSlot).where(eq(schema.eventSlot.id, row.id)).run();
	} else {
		db.update(schema.eventSlot)
			.set({ holdsTo: addDays(endFrom, -1) })
			.where(eq(schema.eventSlot.id, row.id))
			.run();
	}
	return { slot: row };
}

// Ends whatever Slot this Event holds at a position, from a chosen date. The mirror of
// takeEventSlot.
export function clearEventSlot(
	db: Db,
	input: { eventId: string; week: string; day: number; position: number; from: string }
) {
	const week = slotWeek(input.week);
	const day = slotDay(input.day);
	const position = eventPosition(input.position);
	const [held] = db
		.select()
		.from(schema.eventSlot)
		.where(
			and(
				eq(schema.eventSlot.eventId, input.eventId),
				eq(schema.eventSlot.week, week),
				eq(schema.eventSlot.day, day),
				eq(schema.eventSlot.position, position)
			)
		)
		.all()
		.filter((s) => overlaps({ holdsFrom: input.from, holdsTo: null }, s));
	return held ? endEventSlot(db, held, input.from) : null;
}

// What a click on the Event's Timetable grid means, decided in one transaction: a free position
// is taken, the Event's own is cleared from that date, and a position a Class or another Event
// holds on that date is a stale click and a no-op.
export function toggleEventSlot(
	db: Db,
	input: { eventId: string; week: string; day: number; position: number; from: string }
) {
	const week = slotWeek(input.week);
	const day = slotDay(input.day);
	const position = eventPosition(input.position);
	return inTransaction(db.$client, () => {
		const holder = activeEventSlots(db, input.from).find(
			(s) => s.week === week && s.day === day && s.position === position
		);
		if (holder) {
			return holder.eventId === input.eventId
				? clearEventSlot(db, { ...input, week, day, position })
				: null;
		}
		const heldByClass = db
			.select()
			.from(schema.slot)
			.where(
				and(eq(schema.slot.week, week), eq(schema.slot.day, day), eq(schema.slot.period, position))
			)
			.all()
			.some((s) => slotHolds(s, input.from));
		if (heldByClass) return null;
		return takeEventSlot(db, { ...input, week, day, position });
	});
}

// Sets the Room an Event Slot is held in, or clears it when blank. Display only, as on a Slot.
export function setEventSlotRoom(db: Db, { id, room }: { id: string; room: string }) {
	const [row] = db
		.update(schema.eventSlot)
		.set({ room: room.trim() || null })
		.where(eq(schema.eventSlot.id, id))
		.returning()
		.all();
	return row ?? null;
}

export type EventOccurrence = {
	date: string;
	eventId: string;
	name: string;
	kind: (typeof schema.eventKinds)[number];
	week: 'A' | 'B';
	day: number;
	position: number;
	room: string | null;
	note: string | null;
};

// Every date an Event occurs on between two dates inclusive, in calendar order, or every Event's
// when none is named. This is the one definition of "occurs" (ADR-0029): the date is a weekday
// inside a Term, no Blocked Day removes it, and an Event Slot holds there for that Week letter
// and Day. A School Holiday has no Teaching Week and so no letter; a Blocked Day hides the date
// but not its note, which comes back when the day is unblocked.
export function eventOccurrences(
	db: Db,
	{ eventId, from, to }: { eventId?: string; from: string; to: string }
): EventOccurrence[] {
	const cal = loadCalendar(db);
	const blocked = new Set(cal.blockedDays.map((d) => d.date));
	const slots = db
		.select({
			eventId: schema.eventSlot.eventId,
			name: schema.event.name,
			kind: schema.event.kind,
			week: schema.eventSlot.week,
			day: schema.eventSlot.day,
			position: schema.eventSlot.position,
			room: schema.eventSlot.room,
			holdsFrom: schema.eventSlot.holdsFrom,
			holdsTo: schema.eventSlot.holdsTo
		})
		.from(schema.eventSlot)
		.innerJoin(schema.event, eq(schema.event.id, schema.eventSlot.eventId))
		.all()
		.filter((s) => !eventId || s.eventId === eventId);
	const notes = new Map(
		db
			.select()
			.from(schema.eventNote)
			.all()
			.map((n) => [`${n.eventId}|${n.date}`, n.body])
	);

	const out: EventOccurrence[] = [];
	for (const week of cal.teachingWeeks) {
		for (let day = 1; day <= 5; day++) {
			const date = addDays(week.weekCommencing, day - 1);
			if (date < from || date > to) continue;
			if (!inAnyTerm(cal.terms, date) || blocked.has(date)) continue;
			for (const slot of slots) {
				if (slot.week !== week.letter || slot.day !== day || !slotHolds(slot, date)) continue;
				out.push({
					date,
					eventId: slot.eventId,
					name: slot.name,
					kind: slot.kind,
					week: slot.week,
					day,
					position: slot.position,
					room: slot.room,
					note: notes.get(`${slot.eventId}|${date}`) ?? null
				});
			}
		}
	}
	return out.sort((a, b) => a.date.localeCompare(b.date) || a.position - b.position);
}

// Sets the Event note for one Event and date; a blank note deletes it. The date must be one the
// Event occurs on, but it may be in the past, so a date can be logged afterwards. The body is
// stored as typed (ADR-0023).
export function setEventNote(
	db: Db,
	{ eventId, date, note }: { eventId: string; date: string; note: string | null }
) {
	const event = requireRow(db, schema.event, eventId, 'Event not found.');
	if (eventOccurrences(db, { eventId, from: date, to: date }).length === 0) {
		throw new Refused('invalid', `${event.name} does not occur on ${date}.`);
	}
	const body = lessonBody(note);
	if (body === null) {
		db.delete(schema.eventNote)
			.where(and(eq(schema.eventNote.eventId, eventId), eq(schema.eventNote.date, date)))
			.run();
		return;
	}
	db.insert(schema.eventNote)
		.values({ eventId, date, body })
		.onConflictDoUpdate({
			target: [schema.eventNote.eventId, schema.eventNote.date],
			set: { body }
		})
		.run();
}
