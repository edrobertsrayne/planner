// Disruptions: a Blocked Day and a Blocked Slot. Both are scheduling inputs that can be entered
// after the fact, so both re-derive from `rewindBoundary` — the earlier of the date they concern
// and today — rather than from today alone (ADR-0007).
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import {
	rederive,
	rederiveAllClasses,
	rewindBoundary,
	type AtRiskSession,
	type Db,
	type WriteReport
} from './derive';
import { isRealDate, weekday } from '$lib/date';

// A Blocked Day removes every Slot on that date for every Class. Any Session that carried a note
// and was relabelled by the re-derivation is reported back as `atRisk`, rather than silently
// changed, so the teacher can be told.
//
// The same rules every door on the seam applies — the setup-mode list, the grid popover and the
// API: a malformed date, a weekend date, and a date already blocked are refused, and nothing
// else. A Blocked Day outside every Term is allowed, because a closure does not need a Term to
// be real. The status travels with the refusal so a door that distinguishes 400 from 409 can.
export function blockDay(
	db: Db,
	{ date, note, today }: { date: string; note?: string; today: string }
): { ok: true; atRisk: AtRiskSession[] } | { ok: false; status: 400 | 409; reason: string } {
	if (!isRealDate(date)) {
		return { ok: false, status: 400, reason: `"${date}" is not a real date.` };
	}
	if (weekday(date) === 0 || weekday(date) === 6) {
		return {
			ok: false,
			status: 400,
			reason: `"${date}" falls on a weekend. A Blocked Day must be a Monday to Friday.`
		};
	}
	const [existing] = db
		.select({ id: schema.blockedDay.id })
		.from(schema.blockedDay)
		.where(eq(schema.blockedDay.date, date))
		.all();
	if (existing) {
		return { ok: false, status: 409, reason: `"${date}" is already a Blocked Day.` };
	}

	db.insert(schema.blockedDay).values({ date, note }).run();
	return { ok: true, atRisk: rederiveAllClasses(db, rewindBoundary(date, today)) };
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
