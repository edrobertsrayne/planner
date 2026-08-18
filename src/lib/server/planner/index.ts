// THE SEAM. No route file queries Drizzle directly for scheduling data and no route file calls
// the engine directly (issue #28). Speaks the domain language — createClass, addSlot,
// assignTopic, blockDay, blockSlot, recordContinuation, classSchedule — and returns view-ready
// data. Writes re-derive: anything that changes an input to the schedule re-runs `schedule` for
// the affected Class(es) from the boundary and persists the resulting Sessions. There is no
// separate "recompute" action anywhere, ever.
//
// Authoring — createCourse, createTopic and their renames, plus the reads behind the Courses
// view — writes Course/Topic rows directly and never re-derives: a Course and a Topic are not
// themselves scheduling inputs. A Lesson is different: once its Topic is assigned to a Class
// (`assignTopic`, above), the Lesson is part of that Class's schedule, so createLesson,
// updateLesson, deleteLesson, moveLesson and moveLessonToTopic all re-derive every Class with
// that Lesson's Topic (or, for a move, either Topic) assigned, from `today` — quietly, on the
// same write, with no separate recompute step (issue #31).
import { and, asc, eq, gte, inArray, isNotNull, lt, or } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/node-sqlite';
import * as schema from '../db/schema';
import {
	agendaRows,
	schedule,
	rewind,
	runway as deriveRunway,
	type Calendar,
	type Continuation,
	type LessonInput,
	type Runway,
	type ScheduleResult,
	type SessionRecord
} from './engine';

type Db = ReturnType<typeof drizzle>;

function loadCalendar(db: Db): Calendar {
	const terms = db
		.select({ opens: schema.term.opens, closes: schema.term.closes })
		.from(schema.term)
		.all();

	const teachingWeeks = db
		.select({
			weekCommencing: schema.teachingWeek.weekCommencing,
			letter: schema.teachingWeek.letter
		})
		.from(schema.teachingWeek)
		.all();

	const slots = db
		.select({
			id: schema.slot.id,
			classId: schema.slot.classId,
			week: schema.slot.week,
			day: schema.slot.day,
			period: schema.slot.period,
			holdsFrom: schema.slot.holdsFrom,
			holdsTo: schema.slot.holdsTo
		})
		.from(schema.slot)
		.all();

	const blockedDays = db
		.select({ date: schema.blockedDay.date })
		.from(schema.blockedDay)
		.all()
		.map((row) => row.date);

	const blockedSlots = db
		.select({
			classId: schema.blockedSlot.classId,
			date: schema.blockedSlot.date,
			slotId: schema.blockedSlot.slotId
		})
		.from(schema.blockedSlot)
		.all();

	return { terms, teachingWeeks, slots, blockedDays, blockedSlots };
}

// The Lessons of the Class's Assigned Topics, flattened in Assigned-Topic order then Lesson
// order (ADR-0010) — never a Course's Lessons.
function loadLessonStream(db: Db, classId: string): LessonInput[] {
	return db
		.select({ id: schema.lesson.id, plannedLength: schema.lesson.plannedLength })
		.from(schema.assignedTopic)
		.innerJoin(schema.topic, eq(schema.topic.id, schema.assignedTopic.topicId))
		.innerJoin(schema.lesson, eq(schema.lesson.topicId, schema.topic.id))
		.where(eq(schema.assignedTopic.classId, classId))
		.orderBy(asc(schema.assignedTopic.position), asc(schema.lesson.position))
		.all();
}

function loadContinuations(db: Db, classId: string): Continuation[] {
	return db
		.select({ classId: schema.session.classId, lessonId: schema.session.lessonId })
		.from(schema.continuation)
		.innerJoin(schema.session, eq(schema.session.id, schema.continuation.sessionId))
		.where(eq(schema.session.classId, classId))
		.all()
		.filter((row): row is Continuation => row.lessonId !== null);
}

function loadSessions(db: Db, classId: string): SessionRecord[] {
	return db
		.select({
			classId: schema.session.classId,
			date: schema.session.date,
			period: schema.session.period,
			lessonId: schema.session.lessonId
		})
		.from(schema.session)
		.where(eq(schema.session.classId, classId))
		.all()
		.filter((row): row is SessionRecord => row.lessonId !== null);
}

// Recompute a Class's schedule and persist it. Sessions dated before `boundary` are the record of
// what happened and are never touched here — the one exception is a Rewind, which is this same
// operation called with `boundary` set to the date being corrected instead of today.
//
// A Session is identified by its occasion — Class, date, Period — never by row id (ADR-0002), so
// re-deriving updates the existing row for an occasion that is still planned rather than deleting
// and reinserting it: a Continuation references a Session by id, and churning ids on every write
// would silently orphan it. An occasion whose Lesson changes — only possible via a Rewind, since
// ordinary writes never touch a date before boundary — drops any Continuation recorded against it,
// because that Continuation was a reaction to a Lesson which, after the Rewind, was not the one
// taught there, and is reported back as `atRisk` or `discarded` (ADR-0007) rather than silently
// relabelled. An occasion that drops out of the plan entirely (its Slot was blocked) is deleted
// along with any Continuation on it, for the same reason.
function rederive(
	db: Db,
	classId: string,
	boundary: string
): ScheduleResult & { atRisk: SessionRecord[]; discarded: SessionRecord[] } {
	const existing = db
		.select()
		.from(schema.session)
		.where(and(eq(schema.session.classId, classId), gte(schema.session.date, boundary)))
		.all();
	const byOccasion = new Map(existing.map((row) => [`${row.date}|${row.period}`, row]));

	const result = schedule({
		cal: loadCalendar(db),
		lessons: loadLessonStream(db, classId),
		classId,
		sessions: loadSessions(db, classId),
		continuations: loadContinuations(db, classId),
		boundary
	});

	const stillPlanned = new Set<string>();
	const touched: (typeof existing)[number][] = [];

	for (const planned of result.planned) {
		const key = `${planned.date}|${planned.period}`;
		stillPlanned.add(key);
		const row = byOccasion.get(key);

		if (!row) {
			db.insert(schema.session)
				.values({
					classId,
					date: planned.date,
					period: planned.period,
					lessonId: planned.lessonId
				})
				.run();
		} else if (row.lessonId !== planned.lessonId) {
			touched.push(row);
			db.delete(schema.continuation).where(eq(schema.continuation.sessionId, row.id)).run();
			db.update(schema.session)
				.set({ lessonId: planned.lessonId })
				.where(eq(schema.session.id, row.id))
				.run();
		}
	}

	// An occasion still an Available Slot but carrying no Lesson (Unplanned) keeps its row rather
	// than losing it — a note written against it (issue #35) must stay put even though it was
	// never part of `stillPlanned` to begin with.
	const stillUnplanned = new Set(result.unplanned.map((u) => `${u.date}|${u.period}`));

	for (const [key, row] of byOccasion) {
		if (stillPlanned.has(key)) continue;

		if (stillUnplanned.has(key)) {
			if (row.lessonId !== null) {
				touched.push(row);
				db.delete(schema.continuation).where(eq(schema.continuation.sessionId, row.id)).run();
				db.update(schema.session)
					.set({ lessonId: null })
					.where(eq(schema.session.id, row.id))
					.run();
			}
			continue;
		}

		touched.push(row);
		db.delete(schema.continuation).where(eq(schema.continuation.sessionId, row.id)).run();

		// The note is the one irreplaceable thing in the system (#38) — even an occasion that has
		// stopped being an Available Slot at all keeps its row, carrying no Lesson, rather than
		// losing a note Ed wrote against it. Only a note-less row is safe to drop outright.
		if (row.note !== null) {
			db.update(schema.session).set({ lessonId: null }).where(eq(schema.session.id, row.id)).run();
		} else {
			db.delete(schema.session).where(eq(schema.session.id, row.id)).run();
		}
	}

	const touchedWithLesson = touched.filter(
		(row): row is typeof row & { lessonId: string } => row.lessonId !== null
	);
	const { atRisk, discarded } = rewind(touchedWithLesson, classId, boundary);

	return { ...result, atRisk, discarded };
}

// Every Class currently assigned this Topic — the Classes whose schedule a change to one of the
// Topic's Lessons touches.
function classIdsForTopic(db: Db, topicId: string): string[] {
	return db
		.select({ classId: schema.assignedTopic.classId })
		.from(schema.assignedTopic)
		.where(eq(schema.assignedTopic.topicId, topicId))
		.all()
		.map((row) => row.classId);
}

function rederiveTopic(db: Db, topicId: string, today: string) {
	for (const classId of classIdsForTopic(db, topicId)) rederive(db, classId, today);
}

function allClassIds(db: Db): string[] {
	return db
		.select({ id: schema.classes.id })
		.from(schema.classes)
		.all()
		.map((row) => row.id);
}

export function createClass(db: Db, { label, courseId }: { label: string; courseId: string }) {
	const [row] = db.insert(schema.classes).values({ label, courseId }).returning().all();
	return row;
}

// Every Class, alphabetical — what classLanes and the Class page's create form read.
export function listClasses(db: Db) {
	return db
		.select({
			id: schema.classes.id,
			label: schema.classes.label,
			courseId: schema.classes.courseId
		})
		.from(schema.classes)
		.orderBy(asc(schema.classes.label))
		.all();
}

export function classDetail(db: Db, id: string) {
	const [row] = db
		.select({
			id: schema.classes.id,
			label: schema.classes.label,
			courseId: schema.classes.courseId,
			courseName: schema.course.name
		})
		.from(schema.classes)
		.innerJoin(schema.course, eq(schema.course.id, schema.classes.courseId))
		.where(eq(schema.classes.id, id))
		.all();
	return row ?? null;
}

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
// which is what lets two windowed date ranges be compared with plain string comparison.
const MIN_DATE = '0000-01-01';
const MAX_DATE = '9999-12-31';
const from = (d: string | null) => d ?? MIN_DATE;
const to = (d: string | null) => d ?? MAX_DATE;

const overlaps = (
	aFrom: string | null,
	aTo: string | null,
	bFrom: string | null,
	bTo: string | null
) => from(aFrom) <= to(bTo) && from(bFrom) <= to(aTo);

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export function addDays(iso: string, days: number): string {
	const [year, month, day] = iso.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

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
	return (
		slotsAtPosition(db, week, day, period).find((s) => overlaps(on, on, s.holdsFrom, s.holdsTo)) ??
		null
	);
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
	const holdsFrom = input.holdsFrom ?? null;
	const holdsTo = input.holdsTo ?? null;

	const clash = slotsAtPosition(db, input.week, input.day, input.period).find((s) =>
		overlaps(holdsFrom, holdsTo, s.holdsFrom, s.holdsTo)
	);
	if (clash) {
		throw new Error(
			`Week ${input.week} ${DAY_NAMES[input.day - 1]} P${input.period} already belongs to another Class over these dates.`
		);
	}

	const [row] = db
		.insert(schema.slot)
		.values({
			classId: input.classId,
			week: input.week,
			day: input.day,
			period: input.period,
			holdsFrom,
			holdsTo
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
	const on = takeFrom ?? MIN_DATE;
	const holder = holderAt(db, { week, day, period, on });
	if (holder) {
		if (holder.classId === classId) return holder;
		throw new Error(
			`Week ${week} ${DAY_NAMES[day - 1]} P${period} already belongs to another Class over these dates.`
		);
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
		(s) => s.classId === classId && overlaps(clearFrom, null, s.holdsFrom, s.holdsTo)
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
		.filter((s) => overlaps(on, on, s.holdsFrom, s.holdsTo));
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

// Gives a Class one more of its Course's Topics, at the next position in its order, then
// re-derives that Class's schedule from today. Assigning October's Topic in October is an
// ordinary re-run that must not disturb what is already taught (ADR-0007, amended).
export function assignTopic(
	db: Db,
	{ classId, topicId, today }: { classId: string; topicId: string; today: string }
) {
	const [cls] = db
		.select({ courseId: schema.classes.courseId })
		.from(schema.classes)
		.where(eq(schema.classes.id, classId))
		.all();
	const [top] = db
		.select({ courseId: schema.topic.courseId })
		.from(schema.topic)
		.where(eq(schema.topic.id, topicId))
		.all();
	if (!cls || !top || cls.courseId !== top.courseId) {
		throw new Error("This Topic does not belong to the Class's Course.");
	}

	const existing = db
		.select({ position: schema.assignedTopic.position })
		.from(schema.assignedTopic)
		.where(eq(schema.assignedTopic.classId, classId))
		.all();
	const position = existing.length === 0 ? 0 : Math.max(...existing.map((r) => r.position)) + 1;

	db.insert(schema.assignedTopic).values({ classId, topicId, position }).run();

	return rederive(db, classId, today);
}

// A Class's Assigned Topics, in teaching order — the two-column shelf on the Class page.
export function assignedTopicsOf(db: Db, classId: string) {
	return db
		.select({
			id: schema.assignedTopic.id,
			position: schema.assignedTopic.position,
			topicId: schema.topic.id,
			topicName: schema.topic.name
		})
		.from(schema.assignedTopic)
		.innerJoin(schema.topic, eq(schema.topic.id, schema.assignedTopic.topicId))
		.where(eq(schema.assignedTopic.classId, classId))
		.orderBy(asc(schema.assignedTopic.position))
		.all();
}

// Whether a Class has already been taught any Lesson of this Topic, before `today` — what stops
// an Unassign of a Topic the Class has already reached.
function topicReachedByClass(db: Db, classId: string, topicId: string, today: string): boolean {
	const [row] = db
		.select({ id: schema.session.id })
		.from(schema.session)
		.innerJoin(schema.lesson, eq(schema.lesson.id, schema.session.lessonId))
		.where(
			and(
				eq(schema.session.classId, classId),
				eq(schema.lesson.topicId, topicId),
				lt(schema.session.date, today)
			)
		)
		.all();
	return row !== undefined;
}

// Drops a Topic the Class has not yet reached from its Assigned Topics, then re-derives its
// schedule from today. Refused once any of the Topic's Lessons has already been taught to this
// Class — the same Sessions-reference-Lessons reasoning as deleteLesson.
export function unassignTopic(
	db: Db,
	{ classId, id, today }: { classId: string; id: string; today: string }
) {
	const [row] = db
		.select()
		.from(schema.assignedTopic)
		.where(and(eq(schema.assignedTopic.id, id), eq(schema.assignedTopic.classId, classId)))
		.all();
	if (!row) return null;

	if (topicReachedByClass(db, classId, row.topicId, today)) {
		throw new Error('This Topic has already been taught and cannot be unassigned.');
	}

	db.delete(schema.assignedTopic).where(eq(schema.assignedTopic.id, id)).run();
	rederive(db, classId, today);
	return row;
}

// Swaps position with the previous or next Assigned Topic, and re-derives the Class's schedule.
// Off either end is a no-op, same as moveLesson — reordering is free (issue #33), but only ever
// within one Class's own order, never within the Course.
export function moveAssignedTopic(
	db: Db,
	{
		classId,
		id,
		direction,
		today
	}: { classId: string; id: string; direction: 'up' | 'down'; today: string }
) {
	const assigned = assignedTopicsOf(db, classId);
	const index = assigned.findIndex((a) => a.id === id);
	const swapWith = direction === 'up' ? index - 1 : index + 1;
	if (index < 0 || swapWith < 0 || swapWith >= assigned.length) return;

	const a = assigned[index];
	const b = assigned[swapWith];
	db.update(schema.assignedTopic)
		.set({ position: b.position })
		.where(eq(schema.assignedTopic.id, a.id))
		.run();
	db.update(schema.assignedTopic)
		.set({ position: a.position })
		.where(eq(schema.assignedTopic.id, b.id))
		.run();

	rederive(db, classId, today);
}

// A Blocked Day removes every Slot on that date for every Class. Entering one dated before today
// is a disruption discovered after the fact, so every Class is re-derived from that date rather
// than from today — the one place scheduling is allowed to rewrite the record (ADR-0007). Any
// Session that carried a note and was relabelled by the re-derivation is reported back as
// `atRisk`, rather than silently changed, so the teacher can be told.
export function blockDay(
	db: Db,
	{ date, note, today }: { date: string; note?: string; today: string }
) {
	db.insert(schema.blockedDay).values({ date, note }).run();

	const boundary = date < today ? date : today;
	const atRisk: SessionRecord[] = [];
	for (const classId of allClassIds(db)) atRisk.push(...rederive(db, classId, boundary).atRisk);
	return { atRisk };
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
) {
	db.insert(schema.blockedSlot).values({ classId, date, slotId, note }).run();

	const boundary = date < today ? date : today;
	return rederive(db, classId, boundary);
}

// A Session marked as needing more time: its Lesson widens to occupy the next Available Slot too.
// Identified by its occasion (ADR-0002), not by row id — the Session must already be taught
// (dated before today), since a Continuation is a reaction to how teaching actually went, not a
// plan.
export function recordContinuation(
	db: Db,
	{ classId, date, period, today }: { classId: string; date: string; period: number; today: string }
) {
	const [existing] = db
		.select({ id: schema.session.id })
		.from(schema.session)
		.where(
			and(
				eq(schema.session.classId, classId),
				eq(schema.session.date, date),
				eq(schema.session.period, period)
			)
		)
		.all();
	if (!existing) throw new Error(`No Session on ${date} P${period} for this Class.`);
	if (date >= today) throw new Error(`The ${date} P${period} Session has not been taught yet.`);

	db.insert(schema.continuation).values({ sessionId: existing.id }).run();

	return rederive(db, classId, today);
}

export interface SessionDetail {
	classId: string;
	classLabel: string;
	date: string;
	period: number;
	lesson: {
		title: string;
		topicName: string;
		body: string | null;
		links: ReturnType<typeof linksOf>;
	} | null;
	note: string | null;
}

// The Session panel's one read (issue #35) — the only place a Session is read or written. A
// Session is identified by its occasion, not by its Lesson, so this reads by (classId, date,
// period) and never fails to resolve just because the occasion carries no Lesson: an Unplanned
// Slot is still an occasion Ed may want to write about.
export function sessionDetail(
	db: Db,
	{ classId, date, period }: { classId: string; date: string; period: number }
): SessionDetail | null {
	const cls = classDetail(db, classId);
	if (!cls) return null;

	const [row] = db
		.select({ lessonId: schema.session.lessonId, note: schema.session.note })
		.from(schema.session)
		.where(
			and(
				eq(schema.session.classId, classId),
				eq(schema.session.date, date),
				eq(schema.session.period, period)
			)
		)
		.all();

	let lesson: SessionDetail['lesson'] = null;
	if (row?.lessonId) {
		const [lessonRow] = db
			.select({
				title: schema.lesson.title,
				body: schema.lesson.body,
				topicName: schema.topic.name
			})
			.from(schema.lesson)
			.innerJoin(schema.topic, eq(schema.topic.id, schema.lesson.topicId))
			.where(eq(schema.lesson.id, row.lessonId))
			.all();
		if (lessonRow) lesson = { ...lessonRow, links: linksOf(db, row.lessonId) };
	}

	return { classId, classLabel: cls.label, date, period, lesson, note: row?.note ?? null };
}

// The Session panel's one write (issue #35): a free-text note against the occasion, never against
// the Lesson (ADR-0002). Upserts on the occasion's unique key without touching lessonId, so
// writing a note never disturbs the schedule — and an Unplanned Slot, which has no Session row
// until now, gets one carrying no Lesson, purely to hold the note.
export function writeSessionNote(
	db: Db,
	{
		classId,
		date,
		period,
		note
	}: { classId: string; date: string; period: number; note: string | null }
) {
	db.insert(schema.session)
		.values({ classId, date, period, lessonId: null, note })
		.onConflictDoUpdate({
			target: [schema.session.classId, schema.session.date, schema.session.period],
			set: { note }
		})
		.run();
}

export interface AtRiskSession {
	classId: string;
	classLabel: string;
	date: string;
	period: number;
	lessonTitle: string;
}

// A Rewind's report, made readable: each note-carrying Session whose Lesson changed, named by
// Class and Lesson rather than left as bare ids — what blockDay, blockSlot and
// setTeachingWeekLetter's `atRisk` is for (the point of the feature, not a nicety, per #38).
export function describeAtRisk(db: Db, atRisk: SessionRecord[]): AtRiskSession[] {
	if (atRisk.length === 0) return [];

	const classes = new Map(listClasses(db).map((c) => [c.id, c.label]));
	const lessons = new Map(
		db
			.select({ id: schema.lesson.id, title: schema.lesson.title })
			.from(schema.lesson)
			.where(
				inArray(
					schema.lesson.id,
					atRisk.map((s) => s.lessonId)
				)
			)
			.all()
			.map((row) => [row.id, row.title])
	);

	return atRisk.map((s) => ({
		classId: s.classId,
		classLabel: classes.get(s.classId) ?? s.classId,
		date: s.date,
		period: s.period,
		lessonTitle: lessons.get(s.lessonId) ?? s.lessonId
	}));
}

export interface AgendaEntry {
	classId: string;
	classLabel: string;
	date: string;
	week: 'A' | 'B';
	periodFrom: number;
	periodTo: number;
	lesson: { title: string; topicName: string } | null;
}

// The chronological stream of upcoming Sessions across every Class, grouped by day (issue #34).
// The one derived answer the Agenda view reads: every Class's schedule, re-run and never stored,
// windowed to a horizon of calendar days from `today` — so a weekend or a Blocked Day inside it
// honestly produces no row, rather than being padded out to look like a full week of teaching.
export function agenda(db: Db, { today, horizonDays }: { today: string; horizonDays: number }) {
	const horizonEnd = addDays(today, horizonDays);
	const cal = loadCalendar(db);
	const classes = listClasses(db);

	const rows = classes.flatMap((cls) => {
		const result = schedule({
			cal,
			lessons: loadLessonStream(db, cls.id),
			classId: cls.id,
			sessions: loadSessions(db, cls.id),
			continuations: loadContinuations(db, cls.id),
			boundary: today
		});
		return agendaRows(cls.id, result)
			.filter((r) => r.date < horizonEnd)
			.map((r) => ({ ...r, classLabel: cls.label }));
	});

	const lessonIds = [...new Set(rows.flatMap((r) => (r.lesson ? [r.lesson.lessonId] : [])))];
	const names = lessonIds.length
		? new Map(
				db
					.select({
						id: schema.lesson.id,
						title: schema.lesson.title,
						topicName: schema.topic.name
					})
					.from(schema.lesson)
					.innerJoin(schema.topic, eq(schema.topic.id, schema.lesson.topicId))
					.where(inArray(schema.lesson.id, lessonIds))
					.all()
					.map((row) => [row.id, row])
			)
		: new Map<string, { title: string; topicName: string }>();

	const entries: AgendaEntry[] = rows.map((r) => ({
		classId: r.classId,
		classLabel: r.classLabel,
		date: r.date,
		week: r.week,
		periodFrom: r.periodFrom,
		periodTo: r.periodTo,
		lesson: r.lesson ? (names.get(r.lesson.lessonId) ?? null) : null
	}));

	entries.sort((a, b) =>
		(a.date + String(a.periodFrom).padStart(2, '0')).localeCompare(
			b.date + String(b.periodFrom).padStart(2, '0')
		)
	);
	return entries;
}

export interface CalendarCell {
	date: string;
	periodFrom: number;
	periodTo: number;
	classId: string;
	classLabel: string;
	kind: 'lesson' | 'unplanned' | 'blocked';
	lesson: { title: string; topicName: string } | null;
	blockedNote: string | null;
}

export interface CalendarWeek {
	weekCommencing: string;
	letter: 'A' | 'B';
	dates: string[];
	cells: CalendarCell[];
}

const slotHoldsOn = (s: { holdsFrom: string | null; holdsTo: string | null }, date: string) =>
	(!s.holdsFrom || date >= s.holdsFrom) && (!s.holdsTo || date <= s.holdsTo);

// One Teaching Week as Periods × days, across every Class (issue #36). Reuses the same schedule()
// as the Agenda, so a cell's Lesson/Unplanned status always agrees with what the Agenda and the
// Session panel say about the same occasion — there is no separate "calendar" computation of what
// is taught. A position that schedule() stayed silent on — a Blocked Day, a Blocked Slot, or a
// date outside every Term, none of which ever reach availableSlots — is filled in afterwards from
// the raw Timetable, so the grid still shows whose position it is. A position no Class ever holds
// is left out of `cells` entirely: genuinely free, not blocked.
export function calendarWeek(
	db: Db,
	{ weekCommencing, today }: { weekCommencing: string; today: string }
): CalendarWeek | null {
	const [week] = db
		.select({ letter: schema.teachingWeek.letter })
		.from(schema.teachingWeek)
		.where(eq(schema.teachingWeek.weekCommencing, weekCommencing))
		.all();
	if (!week) return null;

	const dates = Array.from({ length: 5 }, (_, i) => addDays(weekCommencing, i));
	const dateSet = new Set(dates);
	const cal = loadCalendar(db);
	const classes = listClasses(db);

	const cells: CalendarCell[] = [];
	const covered = new Set<string>();
	const lessonIds = new Set<string>();
	const perClassRows = classes.map((cls) => {
		const result = schedule({
			cal,
			lessons: loadLessonStream(db, cls.id),
			classId: cls.id,
			sessions: loadSessions(db, cls.id),
			continuations: loadContinuations(db, cls.id),
			boundary: today
		});
		const rows = agendaRows(cls.id, result).filter((r) => dateSet.has(r.date));
		for (const r of rows) if (r.lesson) lessonIds.add(r.lesson.lessonId);
		return { cls, rows };
	});

	const names = lessonIds.size
		? new Map(
				db
					.select({
						id: schema.lesson.id,
						title: schema.lesson.title,
						topicName: schema.topic.name
					})
					.from(schema.lesson)
					.innerJoin(schema.topic, eq(schema.topic.id, schema.lesson.topicId))
					.where(inArray(schema.lesson.id, [...lessonIds]))
					.all()
					.map((row) => [row.id, row])
			)
		: new Map<string, { title: string; topicName: string }>();

	for (const { cls, rows } of perClassRows) {
		for (const r of rows) {
			cells.push({
				date: r.date,
				periodFrom: r.periodFrom,
				periodTo: r.periodTo,
				classId: cls.id,
				classLabel: cls.label,
				kind: r.lesson ? 'lesson' : 'unplanned',
				lesson: r.lesson ? (names.get(r.lesson.lessonId) ?? null) : null,
				blockedNote: null
			});
			for (let p = r.periodFrom; p <= r.periodTo; p++) covered.add(`${r.date}|${p}`);
		}
	}

	const blockedDayNotes = new Map(
		db
			.select({ date: schema.blockedDay.date, note: schema.blockedDay.note })
			.from(schema.blockedDay)
			.all()
			.map((r) => [r.date, r.note])
	);
	const blockedSlotNotes = new Map(
		db
			.select({
				classId: schema.blockedSlot.classId,
				date: schema.blockedSlot.date,
				slotId: schema.blockedSlot.slotId,
				note: schema.blockedSlot.note
			})
			.from(schema.blockedSlot)
			.all()
			.map((r) => [`${r.classId}|${r.date}|${r.slotId}`, r.note])
	);

	dates.forEach((date, i) => {
		const day = i + 1;
		for (let period = 1; period <= 6; period++) {
			if (covered.has(`${date}|${period}`)) continue;
			const slot = cal.slots.find(
				(s) =>
					s.week === week.letter && s.day === day && s.period === period && slotHoldsOn(s, date)
			);
			if (!slot) continue;
			const cls = classes.find((c) => c.id === slot.classId);
			if (!cls) continue;
			cells.push({
				date,
				periodFrom: period,
				periodTo: period,
				classId: cls.id,
				classLabel: cls.label,
				kind: 'blocked',
				lesson: null,
				blockedNote:
					blockedDayNotes.get(date) ?? blockedSlotNotes.get(`${cls.id}|${date}|${slot.id}`) ?? null
			});
		}
	});

	return { weekCommencing, letter: week.letter, dates, cells };
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
// like a Blocked Day: every Class is re-derived from the earlier of the edited week and today, and
// any noted Session that Rewind relabels is reported back as `atRisk` rather than silently changed.
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

	const boundary = weekCommencing < today ? weekCommencing : today;
	const atRisk: SessionRecord[] = [];
	for (const classId of allClassIds(db)) atRisk.push(...rederive(db, classId, boundary).atRisk);
	return { atRisk };
}

// Read back exactly where a Class has got to. Pure: never writes.
export function classSchedule(db: Db, { classId, today }: { classId: string; today: string }) {
	const result = schedule({
		cal: loadCalendar(db),
		lessons: loadLessonStream(db, classId),
		classId,
		sessions: loadSessions(db, classId),
		continuations: loadContinuations(db, classId),
		boundary: today
	});

	return { ...result, runway: deriveRunway(result) };
}

export interface ClassLane {
	classId: string;
	classLabel: string;
	courseId: string;
	taught: number;
	total: number;
	lastTaught: {
		date: string;
		period: number;
		title: string;
		topicName: string;
		note: string | null;
	} | null;
	nextUp: { title: string; topicName: string } | null;
	unplacedCount: number;
	runway: Runway;
}

// One lane per Class (issue #37): how far it has got through its Assigned Topics — never its
// Course (ADR-0010) — what was last taught and its Session note, what is queued next, and the
// Runway. Reuses classSchedule's single derived answer per Class; there is no separate
// Classes-view computation. `classId` restricts to one Class, for the lane atop its own Class page.
export function classLanes(
	db: Db,
	{ today, classId }: { today: string; classId?: string }
): ClassLane[] {
	const classes = classId ? listClasses(db).filter((c) => c.id === classId) : listClasses(db);

	const rows = classes.map((cls) => {
		const result = classSchedule(db, { classId: cls.id, today });
		const total = result.history.length + result.planned.length + result.unplaced.length;
		const lastEntry = result.history[result.history.length - 1] ?? null;
		const nextEntry = result.planned[0] ?? null;
		return { cls, result, total, lastEntry, nextEntry };
	});

	const lessonIds = [
		...new Set(
			rows.flatMap((r) =>
				[r.lastEntry?.lessonId, r.nextEntry?.lessonId].filter((id): id is string => !!id)
			)
		)
	];
	const names = lessonIds.length
		? new Map(
				db
					.select({
						id: schema.lesson.id,
						title: schema.lesson.title,
						topicName: schema.topic.name
					})
					.from(schema.lesson)
					.innerJoin(schema.topic, eq(schema.topic.id, schema.lesson.topicId))
					.where(inArray(schema.lesson.id, lessonIds))
					.all()
					.map((row) => [row.id, row] as const)
			)
		: new Map<string, { title: string; topicName: string }>();

	return rows.map(({ cls, result, total, lastEntry, nextEntry }) => {
		let lastTaught: ClassLane['lastTaught'] = null;
		if (lastEntry) {
			const name = names.get(lastEntry.lessonId);
			if (name) {
				const [noteRow] = db
					.select({ note: schema.session.note })
					.from(schema.session)
					.where(
						and(
							eq(schema.session.classId, cls.id),
							eq(schema.session.date, lastEntry.date),
							eq(schema.session.period, lastEntry.period)
						)
					)
					.all();
				lastTaught = {
					date: lastEntry.date,
					period: lastEntry.period,
					title: name.title,
					topicName: name.topicName,
					note: noteRow?.note ?? null
				};
			}
		}

		const nextName = nextEntry ? names.get(nextEntry.lessonId) : undefined;

		return {
			classId: cls.id,
			classLabel: cls.label,
			courseId: cls.courseId,
			taught: result.history.length,
			total,
			lastTaught,
			nextUp: nextName ? { title: nextName.title, topicName: nextName.topicName } : null,
			unplacedCount: result.unplaced.length,
			runway: result.runway
		};
	});
}

// Authoring — the Courses view.

export function listCourses(db: Db) {
	return db.select().from(schema.course).orderBy(asc(schema.course.name)).all();
}

// No particular order (ADR-0010): a Course is an unordered container of Topics.
export function topicsOf(db: Db, courseId: string) {
	return db.select().from(schema.topic).where(eq(schema.topic.courseId, courseId)).all();
}

export function lessonsOf(db: Db, topicId: string) {
	return db
		.select()
		.from(schema.lesson)
		.where(eq(schema.lesson.topicId, topicId))
		.orderBy(asc(schema.lesson.position))
		.all();
}

export function createCourse(db: Db, { name }: { name: string }) {
	const [row] = db.insert(schema.course).values({ name }).returning().all();
	return row;
}

export function renameCourse(db: Db, { id, name }: { id: string; name: string }) {
	const [row] = db
		.update(schema.course)
		.set({ name })
		.where(eq(schema.course.id, id))
		.returning()
		.all();
	return row;
}

export function createTopic(db: Db, { courseId, name }: { courseId: string; name: string }) {
	const [row] = db.insert(schema.topic).values({ courseId, name }).returning().all();
	return row;
}

export function renameTopic(db: Db, { id, name }: { id: string; name: string }) {
	const [row] = db
		.update(schema.topic)
		.set({ name })
		.where(eq(schema.topic.id, id))
		.returning()
		.all();
	return row;
}

// A title alone is a complete Lesson — no draft state, no required second field. Appended at the
// next position in its Topic's order (ADR-0010: Lessons, unlike Topics, are explicitly ordered).
// Re-derives every Class already assigned this Topic, since a new Lesson changes what those
// Classes still have left to teach.
export function createLesson(
	db: Db,
	{ topicId, title, today }: { topicId: string; title: string; today: string }
) {
	const existing = db
		.select({ position: schema.lesson.position })
		.from(schema.lesson)
		.where(eq(schema.lesson.topicId, topicId))
		.all();
	const position = existing.length === 0 ? 0 : Math.max(...existing.map((r) => r.position)) + 1;

	const [row] = db.insert(schema.lesson).values({ topicId, title, position }).returning().all();
	rederiveTopic(db, topicId, today);
	return row;
}

export function renameLesson(db: Db, { id, title }: { id: string; title: string }) {
	const [row] = db
		.update(schema.lesson)
		.set({ title })
		.where(eq(schema.lesson.id, id))
		.returning()
		.all();
	return row;
}

export function linksOf(db: Db, lessonId: string) {
	return db
		.select()
		.from(schema.link)
		.where(eq(schema.link.lessonId, lessonId))
		.orderBy(asc(schema.link.position))
		.all();
}

// The Lesson editor's one full-detail read: the Lesson plus its Links, in position order.
export function lessonDetail(db: Db, id: string) {
	const [row] = db.select().from(schema.lesson).where(eq(schema.lesson.id, id)).all();
	if (!row) return null;
	return { ...row, links: linksOf(db, id) };
}

// Planned Length is a scheduling input, so this re-derives every Class assigned this Lesson's
// Topic from `today`. Title and body are cosmetic and never move a date, but re-deriving
// regardless is harmless — `rederive` only writes where something actually changed.
export function updateLesson(
	db: Db,
	{
		id,
		title,
		body,
		plannedLength,
		today
	}: { id: string; title: string; body: string | null; plannedLength: number; today: string }
) {
	const [row] = db
		.update(schema.lesson)
		.set({ title, body, plannedLength })
		.where(eq(schema.lesson.id, id))
		.returning()
		.all();
	if (!row) return row;
	rederiveTopic(db, row.topicId, today);
	return row;
}

// Removes a Lesson entirely, along with its Links, and re-derives every Class assigned its
// Topic. Refuses when a Class has already been taught this Lesson: the historical Session rows
// reference it (ADR-0002), so deleting it would erase part of the record of what happened —
// the taught-by block in the Lesson editor is what warns Ed before he tries this and it fails.
export function deleteLesson(db: Db, { id, today }: { id: string; today: string }) {
	const [row] = db.select().from(schema.lesson).where(eq(schema.lesson.id, id)).all();
	if (!row) return null;

	const alreadyTaught = db
		.select({ id: schema.session.id })
		.from(schema.session)
		.where(and(eq(schema.session.lessonId, id), lt(schema.session.date, today)))
		.all();
	if (alreadyTaught.length > 0) {
		throw new Error('This Lesson has already been taught and cannot be deleted.');
	}

	// Not-yet-taught Sessions carrying this Lesson are about to be replaced by `rederiveTopic`
	// below — clear them, and any Continuation on them, before dropping the Lesson row itself.
	const future = db
		.select({ id: schema.session.id })
		.from(schema.session)
		.where(eq(schema.session.lessonId, id))
		.all();
	for (const s of future) {
		db.delete(schema.continuation).where(eq(schema.continuation.sessionId, s.id)).run();
	}
	db.delete(schema.session).where(eq(schema.session.lessonId, id)).run();

	db.delete(schema.link).where(eq(schema.link.lessonId, id)).run();
	db.delete(schema.lesson).where(eq(schema.lesson.id, id)).run();

	rederiveTopic(db, row.topicId, today);
	return row;
}

// Swaps position with the previous or next Lesson in the same Topic, and re-derives every Class
// assigned it. Off either end is a no-op — there is no wraparound and no error, same as moveLink.
export function moveLesson(
	db: Db,
	{
		topicId,
		id,
		direction,
		today
	}: { topicId: string; id: string; direction: 'up' | 'down'; today: string }
) {
	const lessons = lessonsOf(db, topicId);
	const index = lessons.findIndex((l) => l.id === id);
	const swapWith = direction === 'up' ? index - 1 : index + 1;
	if (index < 0 || swapWith < 0 || swapWith >= lessons.length) return;

	const a = lessons[index];
	const b = lessons[swapWith];
	db.update(schema.lesson).set({ position: b.position }).where(eq(schema.lesson.id, a.id)).run();
	db.update(schema.lesson).set({ position: a.position }).where(eq(schema.lesson.id, b.id)).run();

	rederiveTopic(db, topicId, today);
}

// Moves a Lesson to a different Topic, keeping its body, links and Planned Length — appended at
// the end of the new Topic's order. Re-derives every Class assigned either Topic: the old one
// lost a Lesson, the new one gained one.
export function moveLessonToTopic(
	db: Db,
	{ id, topicId, today }: { id: string; topicId: string; today: string }
) {
	const [row] = db.select().from(schema.lesson).where(eq(schema.lesson.id, id)).all();
	if (!row) return null;
	const oldTopicId = row.topicId;

	const existing = db
		.select({ position: schema.lesson.position })
		.from(schema.lesson)
		.where(eq(schema.lesson.topicId, topicId))
		.all();
	const position = existing.length === 0 ? 0 : Math.max(...existing.map((r) => r.position)) + 1;

	const [updated] = db
		.update(schema.lesson)
		.set({ topicId, position })
		.where(eq(schema.lesson.id, id))
		.returning()
		.all();

	rederiveTopic(db, oldTopicId, today);
	if (topicId !== oldTopicId) rederiveTopic(db, topicId, today);
	return updated;
}

// Which Classes have already been taught this Lesson, before `today` — the taught-by block in
// the Lesson editor, so Ed knows an edit here touches a plan already in use.
export function classesTaughtLesson(
	db: Db,
	{ lessonId, today }: { lessonId: string; today: string }
) {
	return db
		.selectDistinct({ id: schema.classes.id, label: schema.classes.label })
		.from(schema.session)
		.innerJoin(schema.classes, eq(schema.classes.id, schema.session.classId))
		.where(and(eq(schema.session.lessonId, lessonId), lt(schema.session.date, today)))
		.orderBy(asc(schema.classes.label))
		.all();
}

// Appended at the next position in its Lesson's order, same as a Lesson within a Topic.
export function createLink(
	db: Db,
	{ lessonId, url, label }: { lessonId: string; url: string; label: string }
) {
	const existing = db
		.select({ position: schema.link.position })
		.from(schema.link)
		.where(eq(schema.link.lessonId, lessonId))
		.all();
	const position = existing.length === 0 ? 0 : Math.max(...existing.map((r) => r.position)) + 1;

	const [row] = db.insert(schema.link).values({ lessonId, url, label, position }).returning().all();
	return row;
}

export function updateLink(db: Db, { id, url, label }: { id: string; url: string; label: string }) {
	const [row] = db
		.update(schema.link)
		.set({ url, label })
		.where(eq(schema.link.id, id))
		.returning()
		.all();
	return row;
}

export function deleteLink(db: Db, { id }: { id: string }) {
	const [row] = db.delete(schema.link).where(eq(schema.link.id, id)).returning().all();
	return row ?? null;
}

// Swaps position with the previous or next Link in the same Lesson. Off either end is a no-op —
// there is no wraparound and no error.
export function moveLink(
	db: Db,
	{ lessonId, id, direction }: { lessonId: string; id: string; direction: 'up' | 'down' }
) {
	const links = linksOf(db, lessonId);
	const index = links.findIndex((l) => l.id === id);
	const swapWith = direction === 'up' ? index - 1 : index + 1;
	if (index < 0 || swapWith < 0 || swapWith >= links.length) return;

	const a = links[index];
	const b = links[swapWith];
	db.update(schema.link).set({ position: b.position }).where(eq(schema.link.id, a.id)).run();
	db.update(schema.link).set({ position: a.position }).where(eq(schema.link.id, b.id)).run();
}
