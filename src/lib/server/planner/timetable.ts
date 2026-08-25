// The Timetable: which Class holds which (Week, Day, Period), and over which dates. A Slot is
// the scheduling input the Calendar turns into Available Slots, so every write here re-derives
// its Class from today.
import { and, asc, eq, isNotNull, or } from 'drizzle-orm';
import { addDays } from '$lib/date';
import * as schema from '../db/schema';
import { rederive, type Db } from './derive';
import { slotHolds } from './engine';

// The date "Changes apply from" defaults to (ADR-0006): the earliest Term's opening date. A
// concrete stand-in for a null holdsFrom, needed wherever the Class page reads the Timetable as
// it stood at the start of the year rather than writes to it.
export function academicYearStart(db: Db): string | null {
	const [row] = db
		.select({ opens: schema.term.opens })
		.from(schema.term)
		.orderBy(asc(schema.term.opens))
		.all();
	return row?.opens ?? null;
}

// Window-aware Slot uniqueness (ADR-0006, amended): null bounds mean "holds for the whole
// year", so they compare as the earliest/latest possible date rather than as "no bound at all" —
// which is what lets two windowed date ranges be compared with plain string comparison. A single
// date is the degenerate case, and is `slotHolds` from the engine rather than a second spelling
// of the same test.
const MIN_DATE = '0000-01-01';
const MAX_DATE = '9999-12-31';
const from = (d: string | null) => d ?? MIN_DATE;
const to = (d: string | null) => d ?? MAX_DATE;

type Window = { holdsFrom: string | null; holdsTo: string | null };

const overlaps = (a: Window, b: Window) =>
	from(a.holdsFrom) <= to(b.holdsTo) && from(b.holdsFrom) <= to(a.holdsTo);

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const positionName = (week: 'A' | 'B', day: number, period: number) =>
	`Week ${week} ${DAY_NAMES[day - 1]} P${period}`;

const takenError = (week: 'A' | 'B', day: number, period: number) =>
	new Error(
		`${positionName(week, day, period)} already belongs to another Class over these dates.`
	);

function slotsAtPosition(db: Db, week: 'A' | 'B', day: number, period: number) {
	return db
		.select()
		.from(schema.slot)
		.where(
			and(eq(schema.slot.week, week), eq(schema.slot.day, day), eq(schema.slot.period, period))
		)
		.all();
}

// Whichever Class holds a Timetable position on one date, if any — what a click on the grid needs
// to know before deciding whether it takes, clears or is refused.
export function holderAt(
	db: Db,
	{ week, day, period, on }: { week: 'A' | 'B'; day: number; period: number; on: string }
) {
	return slotsAtPosition(db, week, day, period).find((s) => slotHolds(s, on)) ?? null;
}

// A Slot's position is (Week, Day, Period), and no two Slots may share one over dates where both
// hold (ADR-0006) — enforced here, at the point of entry, since SQLite has no exclusion
// constraint and a naive unique index would make replacing a Slot mid-year impossible.
export function addSlot(
	db: Db,
	input: {
		classId: string;
		week: 'A' | 'B';
		day: number;
		period: number;
		holdsFrom?: string | null;
		holdsTo?: string | null;
	}
) {
	const window = { holdsFrom: input.holdsFrom ?? null, holdsTo: input.holdsTo ?? null };

	const clash = slotsAtPosition(db, input.week, input.day, input.period).find((s) =>
		overlaps(window, s)
	);
	if (clash) throw takenError(input.week, input.day, input.period);

	const [row] = db
		.insert(schema.slot)
		.values({
			classId: input.classId,
			week: input.week,
			day: input.day,
			period: input.period,
			...window
		})
		.returning()
		.all();
	return row;
}

// Ends a Slot from a chosen date: the day before if it already held earlier, or removed outright
// if it never held before that date — the same operation whether the caller replaces it with
// another Class's Slot or simply drops it. Re-derives its Class's schedule forward from `today`;
// Sessions already taught in it remain historical fact (ADR-0006, amended).
export function endSlot(
	db: Db,
	{ id, from: endFrom, today }: { id: string; from: string; today: string }
) {
	const [row] = db.select().from(schema.slot).where(eq(schema.slot.id, id)).all();
	if (!row) return null;

	if (from(row.holdsFrom) >= endFrom) {
		db.delete(schema.slot).where(eq(schema.slot.id, id)).run();
	} else {
		db.update(schema.slot)
			.set({ holdsTo: addDays(endFrom, -1) })
			.where(eq(schema.slot.id, id))
			.run();
	}

	rederive(db, row.classId, today);
	return row;
}

// Puts a Class in an empty Timetable position from a chosen date. A click on a position already
// held by the clicking Class is a no-op; a position held by another Class *on that date* is
// refused rather than collided with (ADR-0006) — the Class page shows it hatched so this is
// never actually reached from the grid. Replacing another Class's Slot is a separate, explicit
// act: end its Slot first, then take the position.
//
// The pre-check here only sees the position as it stands on `from`, the same single date the
// grid renders — a Class whose Slot there starts later still isn't visible on screen. addSlot's
// own window-aware check is what actually guards the write, and is what catches that case; it
// surfaces as an ordinary rejection rather than a silent collision, just not a pre-emptive hatch.
export function takeSlot(
	db: Db,
	{
		classId,
		week,
		day,
		period,
		from: takeFrom,
		today
	}: {
		classId: string;
		week: 'A' | 'B';
		day: number;
		period: number;
		from: string | null;
		today: string;
	}
) {
	const holder = holderAt(db, { week, day, period, on: takeFrom ?? MIN_DATE });
	if (holder) {
		if (holder.classId === classId) return holder;
		throw takenError(week, day, period);
	}

	const row = addSlot(db, { classId, week, day, period, holdsFrom: takeFrom });
	rederive(db, classId, today);
	return row;
}

// Ends whatever this Class's Slot is at a position, from a chosen date. The mirror of takeSlot.
export function clearSlot(
	db: Db,
	{
		classId,
		week,
		day,
		period,
		from: clearFrom,
		today
	}: {
		classId: string;
		week: 'A' | 'B';
		day: number;
		period: number;
		from: string | null;
		today: string;
	}
) {
	const held = slotsAtPosition(db, week, day, period).find(
		(s) => s.classId === classId && overlaps({ holdsFrom: clearFrom, holdsTo: null }, s)
	);
	if (!held) return null;
	return endSlot(db, { id: held.id, from: clearFrom ?? MIN_DATE, today });
}

// The Timetable as it stands on one date, across every Class — what the Class page's grid
// renders: this Class's own cells, and every other Class's shown hatched.
export function activeSlots(db: Db, on: string) {
	return db
		.select()
		.from(schema.slot)
		.all()
		.filter((s) => slotHolds(s, on));
}

// Every Slot a Class has ever held, live or ended — the Dated periods list, restricted to those
// whose range says something the grid alone cannot: a start after the year began, or an end.
export function datedSlotsOf(db: Db, classId: string) {
	return db
		.select()
		.from(schema.slot)
		.where(
			and(
				eq(schema.slot.classId, classId),
				or(isNotNull(schema.slot.holdsFrom), isNotNull(schema.slot.holdsTo))
			)
		)
		.orderBy(asc(schema.slot.holdsFrom))
		.all();
}
