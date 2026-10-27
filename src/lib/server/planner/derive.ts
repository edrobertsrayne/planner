// Re-derivation: the one place the engine is fed and its answer persisted.
//
// The engine takes six inputs — the Calendar, the Class's Lesson stream, its Sessions, its
// Continuations, its Placements and a boundary — and every caller in the seam needs the same six.
// `scheduleFor` is that call, so a read and a write can never disagree about what a Class's
// schedule is: the Agenda, the Calendar grid, the Class lane and every write all go through it.
import { and, asc, eq, gte, inArray } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../db/schema';
import { generateTeachingWeeks, type TermInput } from '$lib/calendar/generate-teaching-weeks';
import {
	schedule,
	type Calendar,
	type Continuation,
	type LessonInput,
	type Placement,
	type ScheduleResult,
	type SessionRecord
} from './engine';

export type Db = ReturnType<typeof drizzle>;

// An occasion — Class, date, Period — is what identifies a Session (ADR-0002), so it is also the
// key a re-derivation matches existing rows on.
export const occasionKey = (row: { date: string; period: number }) => `${row.date}|${row.period}`;

// The year's Teaching Weeks, derived from the Terms and Blocked Days in hand and never stored
// (spec #158, superseding ADR-0005). The one derivation every reader calls — the accessor below
// and the Calendar snapshot the engine is fed — so none of them can disagree about a letter.
function teachingWeeksFrom(terms: TermInput[], blockedDays: string[]) {
	return generateTeachingWeeks(
		terms,
		blockedDays.map((date) => ({ date }))
	);
}

// One accessor for the year's Teaching Weeks, for the callers that ask for the weeks alone: the
// Calendar ribbon and the one-week grid read through it.
export function teachingWeeks(db: Db) {
	const terms = db
		.select({ opens: schema.term.opens, closes: schema.term.closes })
		.from(schema.term)
		.all();

	const blockedDays = db
		.select({ date: schema.blockedDay.date })
		.from(schema.blockedDay)
		.all()
		.map((row) => row.date);

	return teachingWeeksFrom(terms, blockedDays);
}

export function loadCalendar(db: Db): Calendar {
	const terms = db
		.select({ opens: schema.term.opens, closes: schema.term.closes })
		.from(schema.term)
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
		.select({
			id: schema.blockedDay.id,
			date: schema.blockedDay.date,
			note: schema.blockedDay.note
		})
		.from(schema.blockedDay)
		.all();

	const blockedSlots = db
		.select({
			id: schema.blockedSlot.id,
			classId: schema.blockedSlot.classId,
			date: schema.blockedSlot.date,
			slotId: schema.blockedSlot.slotId,
			note: schema.blockedSlot.note
		})
		.from(schema.blockedSlot)
		.all();

	return {
		terms,
		teachingWeeks: teachingWeeksFrom(
			terms,
			blockedDays.map((day) => day.date)
		),
		slots,
		blockedDays,
		blockedSlots
	};
}

// The Lessons of the Class's Sequence (ADR-0026), in its own order.
function loadLessonStream(db: Db, classId: string): LessonInput[] {
	return db
		.select({ id: schema.lesson.id, length: schema.lesson.length })
		.from(schema.classLesson)
		.innerJoin(schema.lesson, eq(schema.lesson.id, schema.classLesson.lessonId))
		.where(eq(schema.classLesson.classId, classId))
		.orderBy(asc(schema.classLesson.position))
		.all();
}

// A Class's Placements, joined to their Lesson for `length` and to their anchor Slot for the
// Period the teacher chose — same shape as `loadContinuations`/`loadLessonStream`.
function loadPlacements(db: Db, classId: string): Placement[] {
	return db
		.select({
			id: schema.placement.id,
			classId: schema.placement.classId,
			date: schema.placement.date,
			slotId: schema.placement.slotId,
			anchorPeriod: schema.slot.period,
			lessonId: schema.placement.lessonId,
			length: schema.lesson.length
		})
		.from(schema.placement)
		.innerJoin(schema.lesson, eq(schema.lesson.id, schema.placement.lessonId))
		.innerJoin(schema.slot, eq(schema.slot.id, schema.placement.slotId))
		.where(eq(schema.placement.classId, classId))
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
// re-reading the whole Calendar per Class; the Placements are always the Class's stored ones.
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
		placements: loadPlacements(db, classId),
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
// taught there. An occasion that is no longer scheduled (its Slot was blocked, or it is an Open
// Slot) is deleted along with any Continuation on it: a Session row exists only for a Lesson.
// A Teaching note is keyed by Class and Lesson, so it follows its Lesson through all of this.
export function rederive(db: Db, classId: string, boundary: string, cal?: Calendar): WriteReport {
	return rederiveWithResult(db, classId, boundary, cal).report;
}

// `rederive` plus the schedule it laid down, for the Sequence writes that read first dates from it.
// Not part of the index: only sequence.ts uses it.
//
// Never opens a transaction of its own: every scheduling write wraps itself and this call in one
// `inTransaction`, and `inTransaction` runs a bare BEGIN, so a second one nested inside would fail
// rather than join. Callers must therefore never wrap a call that already wraps itself.
export function rederiveWithResult(
	db: Db,
	classId: string,
	boundary: string,
	cal?: Calendar
): { report: WriteReport; result: ScheduleResult } {
	const existing = db
		.select()
		.from(schema.session)
		.where(and(eq(schema.session.classId, classId), gte(schema.session.date, boundary)))
		.all();
	const byOccasion = new Map(existing.map((row) => [occasionKey(row), row]));

	const result = scheduleFor(db, { classId, boundary, cal });

	// A re-derivation only ever changes an occasion's Lesson; the row stays put. Whatever the
	// Lesson becomes, the Continuation recorded against the old one goes: it was a reaction to a
	// Lesson no longer taught there.
	function relabel(row: (typeof existing)[number], lessonId: string) {
		if (row.lessonId === lessonId) return;
		db.delete(schema.continuation).where(eq(schema.continuation.sessionId, row.id)).run();
		db.update(schema.session).set({ lessonId }).where(eq(schema.session.id, row.id)).run();
	}

	const stillScheduled = new Set<string>();
	for (const scheduled of result.scheduled) {
		const key = occasionKey(scheduled);
		stillScheduled.add(key);
		const row = byOccasion.get(key);

		if (!row) {
			db.insert(schema.session)
				.values({
					classId,
					date: scheduled.date,
					period: scheduled.period,
					lessonId: scheduled.lessonId
				})
				.run();
		} else {
			relabel(row, scheduled.lessonId);
		}
	}

	for (const [key, row] of byOccasion) {
		if (stillScheduled.has(key)) continue;
		db.delete(schema.continuation).where(eq(schema.continuation.sessionId, row.id)).run();
		db.delete(schema.session).where(eq(schema.session.id, row.id)).run();
	}

	return { report: { placementsMoved: describePlacementsMoved(db, result) }, result };
}

// Folds one WriteReport per Class into the single combined report every multi-Class re-derive
// (rederiveAllClasses, editLesson) returns.
export function combineReports(reports: WriteReport[]): WriteReport {
	return { placementsMoved: reports.flatMap((r) => r.placementsMoved) };
}

// Re-derives every Class from a boundary and collects the combined report — shared by every
// scheduling input that isn't scoped to one Class (a Blocked Day, its removal, and the Week
// letter), so the aggregation logic lives in exactly one place. One Calendar is loaded for the
// whole year rather than once per Class.
export function rederiveAllClasses(db: Db, boundary: string): WriteReport {
	const cal = loadCalendar(db);
	const classIds = db
		.select({ id: schema.classes.id })
		.from(schema.classes)
		.all()
		.map((row) => row.id);

	return combineReports(classIds.map((classId) => rederive(db, classId, boundary, cal)));
}

export interface PlacementMoved {
	placementId: string;
	classId: string;
	classLabel: string;
	lessonTitle: string;
	anchorDate: string;
	anchorPeriod: number;
	date: string;
	period: number;
	// Set when every Available Slot at or after the anchor is gone, so the Placement has nowhere
	// left to land at all — `date`/`period` repeat the anchor, since there is no landing to name.
	stranded?: boolean;
}

// What every scheduling write answers in one call: `placementsMoved` names each Placement whose
// anchor a Blocked Day or Blocked Slot has pushed off, already named by Class and Lesson — the
// describing lives inside `rederive` so no caller can forget it.
export type WriteReport = { placementsMoved: PlacementMoved[] };

// A write that answers with more than its report (`{ lesson, ...WriteReport }`, `{ slot, ... }`)
// hands the doors this one way to take the report out, so no door names the part.
export const reportOf = ({ placementsMoved }: WriteReport): WriteReport => ({ placementsMoved });

export interface LessonName {
	title: string;
	topicName: string | null;
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
			.leftJoin(schema.topic, eq(schema.topic.id, schema.lesson.topicId))
			.where(inArray(schema.lesson.id, [...ids]))
			.all()
			.map(({ id, title, topicName }) => [id, { title, topicName }])
	);
}

// Where each Placement's run landed, as the engine already resolved it, compared against the
// anchor the teacher chose. A Placement with no landing this call is never reported: either
// history already holds every part, or it holds part 1 and the run is a multi-day one still in
// progress. History is frozen, so neither can have moved (ADR-0022). A stranded Placement — every
// Slot at or after its anchor gone — has a null landing and is always reported, since silence
// there would be indistinguishable from "nothing changed".
function describePlacementsMoved(db: Db, result: ScheduleResult): PlacementMoved[] {
	const moved = result.placementLandings.filter(
		({ anchor, landing }) =>
			landing === null || landing.date !== anchor.date || landing.period !== anchor.period
	);
	if (moved.length === 0) return [];

	const labels = new Map(
		db
			.select({ id: schema.classes.id, label: schema.classes.label })
			.from(schema.classes)
			.all()
			.map((row) => [row.id, row.label])
	);
	const names = lessonNames(
		db,
		moved.map((landing) => landing.lessonId)
	);

	return moved.map(({ placementId, classId, lessonId, anchor, landing }) => ({
		placementId,
		classId,
		classLabel: labels.get(classId) ?? classId,
		lessonTitle: names.get(lessonId)?.title ?? lessonId,
		anchorDate: anchor.date,
		anchorPeriod: anchor.period,
		date: landing?.date ?? anchor.date,
		period: landing?.period ?? anchor.period,
		...(landing ? {} : { stranded: true })
	}));
}
