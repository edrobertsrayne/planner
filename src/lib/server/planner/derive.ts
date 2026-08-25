// Re-derivation: the one place the engine is fed and its answer persisted.
//
// The engine takes five inputs — the Calendar, the Class's Lesson stream, its Sessions, its
// Continuations and a boundary — and every caller in the seam needs the same five. `scheduleFor`
// is that call, so a read and a write can never disagree about what a Class's schedule is: the
// Agenda, the Calendar grid, the Class lane and every write all go through it.
import { and, asc, eq, gte, inArray } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../db/schema';
import {
	schedule,
	rewind,
	type Calendar,
	type Continuation,
	type LessonInput,
	type ScheduleResult,
	type SessionRecord
} from './engine';

export type Db = ReturnType<typeof drizzle>;

// An occasion — Class, date, Period — is what identifies a Session (ADR-0002), so it is also the
// key a re-derivation matches existing rows on.
export const occasionKey = (row: { date: string; period: number }) => `${row.date}|${row.period}`;

export function loadCalendar(db: Db): Calendar {
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

// One Class's schedule from a boundary — the seam's only route into the engine. Pure: never
// writes. Callers that schedule several Classes at once pass a Calendar loaded once rather than
// re-reading the whole Calendar per Class.
export function scheduleFor(
	db: Db,
	{ classId, boundary, cal }: { classId: string; boundary: string; cal?: Calendar }
): ScheduleResult {
	return schedule({
		cal: cal ?? loadCalendar(db),
		lessons: loadLessonStream(db, classId),
		classId,
		sessions: loadSessions(db, classId),
		continuations: loadContinuations(db, classId),
		boundary
	});
}

// The boundary a disruption is re-derived from: its own date when it is being entered after the
// fact, otherwise today. Entering a past disruption is the one place scheduling is allowed to
// rewrite the record (ADR-0007), and every write that can be dated in the past picks its
// boundary the same way.
export const rewindBoundary = (date: string, today: string) => (date < today ? date : today);

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
export function rederive(db: Db, classId: string, boundary: string): WriteReport {
	const existing = db
		.select()
		.from(schema.session)
		.where(and(eq(schema.session.classId, classId), gte(schema.session.date, boundary)))
		.all();
	const byOccasion = new Map(existing.map((row) => [occasionKey(row), row]));

	const result = scheduleFor(db, { classId, boundary });

	const touched: (typeof existing)[number][] = [];

	// A re-derivation only ever changes an occasion's Lesson; the row, and the note on it, stay
	// put. Whatever the Lesson becomes, the Continuation recorded against the old one goes: it
	// was a reaction to a Lesson no longer taught there.
	function relabel(row: (typeof existing)[number], lessonId: string | null) {
		if (row.lessonId === lessonId) return;
		touched.push(row);
		db.delete(schema.continuation).where(eq(schema.continuation.sessionId, row.id)).run();
		db.update(schema.session).set({ lessonId }).where(eq(schema.session.id, row.id)).run();
	}

	const stillPlanned = new Set<string>();
	for (const planned of result.planned) {
		const key = occasionKey(planned);
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
		} else {
			relabel(row, planned.lessonId);
		}
	}

	// An occasion still an Available Slot but carrying no Lesson (Unplanned) keeps its row rather
	// than losing it — a note written against it (issue #35) must stay put even though it was
	// never part of `stillPlanned` to begin with.
	const stillUnplanned = new Set(result.unplanned.map(occasionKey));

	for (const [key, row] of byOccasion) {
		if (stillPlanned.has(key)) continue;

		if (stillUnplanned.has(key)) {
			relabel(row, null);
			continue;
		}

		// The occasion has stopped being an Available Slot at all — its Slot was blocked.
		touched.push(row);
		db.delete(schema.continuation).where(eq(schema.continuation.sessionId, row.id)).run();

		// The note is the one irreplaceable thing in the system (#38) — even here the row stays,
		// carrying no Lesson, rather than losing a note Ed wrote against it. Only a note-less row
		// is safe to drop outright.
		if (row.note !== null) {
			db.update(schema.session).set({ lessonId: null }).where(eq(schema.session.id, row.id)).run();
		} else {
			db.delete(schema.session).where(eq(schema.session.id, row.id)).run();
		}
	}

	const touchedWithLesson = touched.filter(
		(row): row is typeof row & { lessonId: string } => row.lessonId !== null
	);
	const { atRisk } = rewind(touchedWithLesson, classId, boundary);

	return { atRisk: describeAtRisk(db, atRisk) };
}

// Every Class currently assigned this Topic — the Classes whose schedule a change to one of the
// Topic's Lessons touches.
export function rederiveTopic(db: Db, topicId: string, today: string) {
	const classIds = db
		.select({ classId: schema.assignedTopic.classId })
		.from(schema.assignedTopic)
		.where(eq(schema.assignedTopic.topicId, topicId))
		.all()
		.map((row) => row.classId);

	for (const classId of classIds) rederive(db, classId, today);
}

// Re-derives every Class from a boundary and collects the combined atRisk report — shared by
// every scheduling input that isn't scoped to one Class (a Blocked Day, its removal, and the
// Week letter), so the aggregation logic lives in exactly one place.
export function rederiveAllClasses(db: Db, boundary: string): AtRiskSession[] {
	const classIds = db
		.select({ id: schema.classes.id })
		.from(schema.classes)
		.all()
		.map((row) => row.id);

	return classIds.flatMap((classId) => rederive(db, classId, boundary).atRisk);
}

export interface AtRiskSession {
	classId: string;
	classLabel: string;
	date: string;
	period: number;
	lessonTitle: string;
}

// What every scheduling write answers in one call: the Rewind's report of noted Sessions whose
// Lesson the re-derivation changed, already named by Class and Lesson — the describing lives
// inside `rederive` so no caller can forget it.
export type WriteReport = { atRisk: AtRiskSession[] };

export interface LessonName {
	title: string;
	topicName: string;
}

// The engine speaks Lesson ids; every view built on it needs titles. One query for the whole
// batch — the Agenda, the Calendar grid and the Class lanes each resolve every Lesson they are
// about to render in a single round trip rather than one per row.
export function lessonNames(db: Db, ids: readonly string[]): Map<string, LessonName> {
	if (ids.length === 0) return new Map();

	return new Map(
		db
			.select({
				id: schema.lesson.id,
				title: schema.lesson.title,
				topicName: schema.topic.name
			})
			.from(schema.lesson)
			.innerJoin(schema.topic, eq(schema.topic.id, schema.lesson.topicId))
			.where(inArray(schema.lesson.id, [...ids]))
			.all()
			.map(({ id, title, topicName }) => [id, { title, topicName }])
	);
}

// A Rewind's report, made readable: each note-carrying Session whose Lesson changed, named by
// Class and Lesson rather than left as bare ids — what blockDay, blockSlot and
// setTeachingWeekLetter's `atRisk` is for (the point of the feature, not a nicety, per #38).
// Private by design: every write describes its own report before returning.
function describeAtRisk(db: Db, atRisk: SessionRecord[]): AtRiskSession[] {
	if (atRisk.length === 0) return [];

	const labels = new Map(
		db
			.select({ id: schema.classes.id, label: schema.classes.label })
			.from(schema.classes)
			.all()
			.map((row) => [row.id, row.label])
	);
	const names = lessonNames(
		db,
		atRisk.map((s) => s.lessonId)
	);

	return atRisk.map((s) => ({
		classId: s.classId,
		classLabel: labels.get(s.classId) ?? s.classId,
		date: s.date,
		period: s.period,
		lessonTitle: names.get(s.lessonId)?.title ?? s.lessonId
	}));
}
