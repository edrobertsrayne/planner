// Events: recurring commitments of the teacher's own that are not Classes (ADR-0029). An Event
// holds Event Slots, and an Event Slot never shares a position with a Class's Slot, so an Event
// is never an input to the schedule and nothing here re-derives a Class.
import { and, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { Db } from './derive';
import { eventKind, eventPosition, required, requireRow, slotDay, slotWeek } from './fields';
import { Refused } from './refused';
import { overlaps, positionName } from './timetable';

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
