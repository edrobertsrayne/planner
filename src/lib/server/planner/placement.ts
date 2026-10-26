// Placement: putting one Standalone Lesson directly onto one Class's schedule, on one date the
// teacher chooses, with no Topic behind it (ADR-0022). Placing and removing mirror
// disruptions.ts's blockSlot/unblockSlot exactly — a Placement is a scheduling input, never a
// write to the schedule's output — with two additions: Placing also creates the Standalone
// Lesson the Placement names, and removing prunes Readiness once the (Lesson, Class) pairing it
// was recorded against no longer exists.
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { inTransaction } from '../db';
import { rederive, rewindBoundary, type Db, type WriteReport } from './derive';
import { endPairing } from './teaching-notes';
import { isRealDate } from '$lib/date';
import { Refused, type RefusalKind } from './refused';
import { required } from './fields';
import { classSchedule } from './classes';
import type { Occasion } from './sessions';

// Where a Lesson may be Placed, and the one answer both screens and the door read (ADR-0025):
// today or later, in a Slot the Class holds on that date and that the Calendar has not removed,
// and not on an occasion that already holds a placed Lesson. A Slot a Topic Lesson holds is
// admitted: a Placement claims its Slot ahead of the Topic stream and shifts that Lesson right.
export type PlacementAdmission =
	{ admitted: true; slotId: string } | { admitted: false; kind: RefusalKind; reason: string };

export function placementAdmission(
	db: Db,
	{ classId, date, period, today }: Occasion & { today: string }
): PlacementAdmission {
	if (!isRealDate(date)) {
		return { admitted: false, kind: 'invalid', reason: `"${date}" is not a real date.` };
	}
	if (date < today) {
		return {
			admitted: false,
			kind: 'invalid',
			reason: `"${date}" is in the past. A Placement is made for today or a later date, never a past one.`
		};
	}

	const { scheduled, openSlots } = classSchedule(db, { classId, today });
	const atOccasion = (slot: { date: string; period: number }) =>
		slot.date === date && slot.period === period;

	const open = openSlots.find(atOccasion);
	if (open) return { admitted: true, slotId: open.slotId };

	const held = scheduled.find(atOccasion);
	if (!held) {
		return {
			admitted: false,
			kind: 'invalid',
			reason: `${date} P${period} is not an Available Slot.`
		};
	}
	if (held.placementId) {
		return {
			admitted: false,
			kind: 'conflict',
			reason: `${date} P${period} already holds a placed Lesson.`
		};
	}
	return { admitted: true, slotId: held.slotId };
}

// Creates a fresh Standalone Lesson (`topicId: null`, `position: 0`, since it belongs to no
// Topic's order) and a Placement anchoring it to one Class, one date and one Slot, then
// re-derives that Class from today. A Placement is made for today or a later date, never a past
// one (GLOSSARY.md) — unlike a Blocked Day or a Blocked Slot, which exist precisely to record a
// disruption after the fact. The Lesson, its Placement and the re-derivation commit together:
// without that, a failed Placement insert (a taken anchor, a Class or Slot gone) would leave the
// freshly created Standalone Lesson behind with no Placement naming it, and a failed
// re-derivation would leave a Placement with no Session to show for it.
//
// Every refusal is `placementAdmission`'s, and the caller names only an occasion: the Slot and
// every rule about it live here, so a second door cannot place onto a Blocked Slot or another
// Class's.
export function placeLesson(
	db: Db,
	{ classId, date, period, title, today }: Occasion & { title: string; today: string }
): { lesson: typeof schema.lesson.$inferSelect } & WriteReport {
	const admission = placementAdmission(db, { classId, date, period, today });
	if (!admission.admitted) throw new Refused(admission.kind, admission.reason);

	return inTransaction(db.$client, () => {
		const [lesson] = db
			.insert(schema.lesson)
			.values({ topicId: null, title: required(title, 'A Lesson needs a title.'), position: 0 })
			.returning()
			.all();
		db.insert(schema.placement)
			.values({ classId, date, slotId: admission.slotId, lessonId: lesson.id })
			.run();

		return { lesson, ...rederive(db, classId, today) };
	});
}

// Removes a Placement and re-derives its one Class, the mirror of unblockSlot — no past-date
// refusal, because Rewind exists precisely to let a disruption be entered after the fact
// (ADR-0022) and there is no such guard anywhere else in the system. The Lesson itself survives,
// left standing as a Standalone Lesson no Placement names.
//
// Readiness and the Teaching note for the (Lesson, Class) pairing die with the Placement. A
// taught Placement can still be removed; its note goes. The removal, the pruning and the
// re-derivation commit together, so a failed re-derivation leaves the Placement in place with the
// marks it still owns.
export function removePlacement(db: Db, { id, today }: { id: string; today: string }) {
	const [row] = db.select().from(schema.placement).where(eq(schema.placement.id, id)).all();
	if (!row) return null;

	return inTransaction(db.$client, () => {
		db.delete(schema.placement).where(eq(schema.placement.id, id)).run();
		endPairing(db, row.classId, [row.lessonId]);

		return rederive(db, row.classId, rewindBoundary(row.date, today));
	});
}
