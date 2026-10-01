// Placement: putting one Standalone Lesson directly onto one Class's schedule, on one date the
// teacher chooses, with no Topic behind it (ADR-0022). Placing and removing mirror
// disruptions.ts's blockSlot/unblockSlot exactly — a Placement is a scheduling input, never a
// write to the schedule's output — with two additions: Placing also creates the Standalone
// Lesson the Placement names, and removing prunes Readiness once the (Lesson, Class) pairing it
// was recorded against no longer exists.
import type { Database } from 'bun:sqlite';
import { and, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { inTransaction } from '../db';
import { rederive, rewindBoundary, type Db, type WriteReport } from './derive';
import { isRealDate } from '$lib/date';
import { Refused } from './refused';

// Creates a fresh Standalone Lesson (`topicId: null`, `position: 0`, since it belongs to no
// Topic's order) and a Placement anchoring it to one Class, one date and one Slot, then
// re-derives that Class from the earlier of the date and today. A Placement is made for today or
// a later date, never a past one (CONTEXT.md) — unlike a Blocked Day or a Blocked Slot, which
// exist precisely to record a disruption after the fact. The Lesson and its Placement are
// created in one transaction, driven on the raw client exactly as the Topic import already is —
// without it, a failed Placement insert (a taken anchor, a Class or Slot gone) would leave the
// freshly created Standalone Lesson behind with no Placement naming it.
//
// A malformed date and a past date are `invalid`: bad input, bad before it reaches the calendar.
export function placeLesson(
	db: Db,
	client: Database,
	{
		classId,
		date,
		slotId,
		title,
		today
	}: { classId: string; date: string; slotId: string; title: string; today: string }
): { lesson: typeof schema.lesson.$inferSelect } & WriteReport {
	if (!isRealDate(date)) {
		throw new Refused('invalid', `"${date}" is not a real date.`);
	}
	if (date < today) {
		throw new Refused(
			'invalid',
			`"${date}" is in the past. A Placement is made for today or a later date, never a past one.`
		);
	}

	const lesson = inTransaction(client, () => {
		const [lesson] = db
			.insert(schema.lesson)
			.values({ topicId: null, title, position: 0 })
			.returning()
			.all();
		db.insert(schema.placement).values({ classId, date, slotId, lessonId: lesson.id }).run();
		return lesson;
	});

	return { lesson, ...rederive(db, classId, rewindBoundary(date, today)) };
}

// Removes a Placement and re-derives its one Class, the mirror of unblockSlot — no past-date
// refusal, because Rewind exists precisely to let a disruption be entered after the fact
// (ADR-0022) and there is no such guard anywhere else in the system. The Lesson itself survives,
// left standing as a Standalone Lesson no Placement names.
//
// Readiness for the (Lesson, Class) pairing dies with the Placement, mirroring the rule
// unassignTopic already enforces — but only once no other Placement still names that same pair,
// since the same Lesson may be placed twice on one Class on two dates.
export function removePlacement(db: Db, { id, today }: { id: string; today: string }) {
	const [row] = db.select().from(schema.placement).where(eq(schema.placement.id, id)).all();
	if (!row) return null;

	db.delete(schema.placement).where(eq(schema.placement.id, id)).run();

	const [survivor] = db
		.select({ id: schema.placement.id })
		.from(schema.placement)
		.where(
			and(eq(schema.placement.lessonId, row.lessonId), eq(schema.placement.classId, row.classId))
		)
		.all();
	if (!survivor) {
		db.delete(schema.readiness)
			.where(
				and(eq(schema.readiness.lessonId, row.lessonId), eq(schema.readiness.classId, row.classId))
			)
			.run();
	}

	return rederive(db, row.classId, rewindBoundary(row.date, today));
}
