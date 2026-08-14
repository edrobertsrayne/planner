// THE SEAM. No route file queries Drizzle directly for scheduling data and no route file calls
// the engine directly (issue #28). Speaks the domain language — createClass, addSlot,
// assignTopic, blockDay, blockSlot, recordContinuation, classSchedule — and returns view-ready
// data. Writes re-derive: anything that changes an input to the schedule re-runs `schedule` for
// the affected Class(es) from the boundary and persists the resulting Sessions. There is no
// separate "recompute" action anywhere, ever.
import { and, asc, eq, gte } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/node-sqlite';
import * as schema from '../db/schema';
import {
	schedule,
	rewind,
	runway as deriveRunway,
	type Calendar,
	type Continuation,
	type LessonInput,
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

	for (const [key, row] of byOccasion) {
		if (stillPlanned.has(key)) continue;
		touched.push(row);
		db.delete(schema.continuation).where(eq(schema.continuation.sessionId, row.id)).run();
		db.delete(schema.session).where(eq(schema.session.id, row.id)).run();
	}

	const touchedWithLesson = touched.filter(
		(row): row is typeof row & { lessonId: string } => row.lessonId !== null
	);
	const { atRisk, discarded } = rewind(touchedWithLesson, classId, boundary);

	return { ...result, atRisk, discarded };
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

export function addSlot(
	db: Db,
	input: {
		classId: string;
		week: 'A' | 'B';
		day: number;
		period: number;
		holdsFrom?: string;
		holdsTo?: string;
	}
) {
	const [row] = db.insert(schema.slot).values(input).returning().all();
	return row;
}

// Gives a Class one more of its Course's Topics, at the next position in its order, then
// re-derives that Class's schedule from today. Assigning October's Topic in October is an
// ordinary re-run that must not disturb what is already taught (ADR-0007, amended).
export function assignTopic(
	db: Db,
	{ classId, topicId, today }: { classId: string; topicId: string; today: string }
) {
	const existing = db
		.select({ position: schema.assignedTopic.position })
		.from(schema.assignedTopic)
		.where(eq(schema.assignedTopic.classId, classId))
		.all();
	const position = existing.length === 0 ? 0 : Math.max(...existing.map((r) => r.position)) + 1;

	db.insert(schema.assignedTopic).values({ classId, topicId, position }).run();

	return rederive(db, classId, today);
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
