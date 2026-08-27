// Disruptions: a Blocked Day, a Blocked Slot, and the Week letter. All three are scheduling
// inputs that can be entered after the fact, so all three re-derive from `rewindBoundary` —
// the earlier of the date they concern and today — rather than from today alone (ADR-0007).
import { asc, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { rederive, rederiveAllClasses, rewindBoundary, type Db, type WriteReport } from './derive';

// A Blocked Day removes every Slot on that date for every Class. Any Session that carried a note
// and was relabelled by the re-derivation is reported back as `atRisk`, rather than silently
// changed, so the teacher can be told.
export function blockDay(
	db: Db,
	{ date, note, today }: { date: string; note?: string; today: string }
): WriteReport {
	db.insert(schema.blockedDay).values({ date, note }).run();
	return { atRisk: rederiveAllClasses(db, rewindBoundary(date, today)) };
}

// A Blocked Slot removes one Slot on one date for one Class, leaving every other Class untouched.
export function blockSlot(
	db: Db,
	{
		classId,
		date,
		slotId,
		note,
		today
	}: { classId: string; date: string; slotId: string; note: string; today: string }
): WriteReport {
	db.insert(schema.blockedSlot).values({ classId, date, slotId, note }).run();
	return rederive(db, classId, rewindBoundary(date, today));
}

// Removes a Blocked Day and re-derives every Class, the mirror of blockDay: undoing an ad hoc
// closure is exactly as much of a Rewind as recording one was. A date addresses the day — a date
// is unique where a title is not, so the id the table generates is not needed on the way out.
export function unblockDay(db: Db, { date, today }: { date: string; today: string }) {
	const [row] = db.select().from(schema.blockedDay).where(eq(schema.blockedDay.date, date)).all();
	if (!row) return null;

	db.delete(schema.blockedDay).where(eq(schema.blockedDay.date, date)).run();
	return { atRisk: rederiveAllClasses(db, rewindBoundary(date, today)) };
}

// Removes a Blocked Slot and re-derives its one Class, the mirror of blockSlot.
export function unblockSlot(db: Db, { id, today }: { id: string; today: string }) {
	const [row] = db.select().from(schema.blockedSlot).where(eq(schema.blockedSlot.id, id)).all();
	if (!row) return null;

	db.delete(schema.blockedSlot).where(eq(schema.blockedSlot.id, id)).run();
	return rederive(db, row.classId, rewindBoundary(row.date, today));
}

// Every Teaching Week, in order — the ribbon on the Calendar steps through this.
export function teachingWeeksList(db: Db) {
	return db
		.select({
			weekCommencing: schema.teachingWeek.weekCommencing,
			letter: schema.teachingWeek.letter
		})
		.from(schema.teachingWeek)
		.orderBy(asc(schema.teachingWeek.weekCommencing))
		.all();
}

// The Week letter is stored, never computed (ADR-0005), and editable here for the one-off "we'll
// stay on Week A next week" the school announces after a disruption. It is a scheduling input
// like a Blocked Day, and re-derives on the same terms.
export function setTeachingWeekLetter(
	db: Db,
	{ weekCommencing, letter, today }: { weekCommencing: string; letter: 'A' | 'B'; today: string }
) {
	const updated = db
		.update(schema.teachingWeek)
		.set({ letter })
		.where(eq(schema.teachingWeek.weekCommencing, weekCommencing))
		.returning()
		.all();
	if (!updated.length) return null;

	return { atRisk: rederiveAllClasses(db, rewindBoundary(weekCommencing, today)) };
}
