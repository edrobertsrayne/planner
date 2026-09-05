// Re-derivation: the one place the engine is fed and its answer persisted.
//
// The engine takes five inputs — the Calendar, the Class's Lesson stream, its Sessions, its
// Continuations and a boundary — and every caller in the seam needs the same five. `scheduleFor`
// is that call, so a read and a write can never disagree about what a Class's schedule is: the
// Agenda, the Calendar grid, the Class lane and every write all go through it.
import { and, asc, eq, gte, inArray } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../db/schema';
import { generateTeachingWeeks, type TermInput } from '$lib/calendar/generate-teaching-weeks';
import {
	schedule,
	rewind,
	type Calendar,
	type Continuation,
	type LessonInput,
	type Placement,
	type ScheduledSession,
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

	return {
		terms,
		teachingWeeks: teachingWeeksFrom(terms, blockedDays),
		slots,
		blockedDays,
		blockedSlots
	};
}

// The Lessons of the Class's Assigned Topics, flattened in Assigned-Topic order then Lesson
// order (ADR-0010) — never a Course's Lessons.
function loadLessonStream(db: Db, classId: string): LessonInput[] {
	return db
		.select({ id: schema.lesson.id, length: schema.lesson.length })
		.from(schema.assignedTopic)
		.innerJoin(schema.topic, eq(schema.topic.id, schema.assignedTopic.topicId))
		.innerJoin(schema.lesson, eq(schema.lesson.topicId, schema.topic.id))
		.where(eq(schema.assignedTopic.classId, classId))
		.orderBy(asc(schema.assignedTopic.position), asc(schema.lesson.position))
		.all();
}

// A Class's Placements, joined to their Lesson for `length` — same shape as
// `loadContinuations`/`loadLessonStream`.
function loadPlacements(db: Db, classId: string): Placement[] {
	return db
		.select({
			id: schema.placement.id,
			classId: schema.placement.classId,
			date: schema.placement.date,
			slotId: schema.placement.slotId,
			lessonId: schema.placement.lessonId,
			length: schema.lesson.length
		})
		.from(schema.placement)
		.innerJoin(schema.lesson, eq(schema.lesson.id, schema.placement.lessonId))
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
// re-reading the whole Calendar per Class.
export function scheduleFor(
	db: Db,
	{
		classId,
		boundary,
		cal,
		placements
	}: { classId: string; boundary: string; cal?: Calendar; placements?: Placement[] }
): ScheduleResult {
	return schedule({
		cal: cal ?? loadCalendar(db),
		lessons: loadLessonStream(db, classId),
		classId,
		sessions: loadSessions(db, classId),
		continuations: loadContinuations(db, classId),
		placements: placements ?? loadPlacements(db, classId),
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
export function rederive(db: Db, classId: string, boundary: string, cal?: Calendar): WriteReport {
	const existing = db
		.select()
		.from(schema.session)
		.where(and(eq(schema.session.classId, classId), gte(schema.session.date, boundary)))
		.all();
	const byOccasion = new Map(existing.map((row) => [occasionKey(row), row]));

	const resolvedCal = cal ?? loadCalendar(db);
	const placements = loadPlacements(db, classId);
	const result = scheduleFor(db, { classId, boundary, cal: resolvedCal, placements });

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

	// An occasion still an Available Slot but carrying no Lesson (Open Slot) keeps its row rather
	// than losing it — a note written against it (issue #35) must stay put even though it was
	// never part of `stillScheduled` to begin with.
	const stillOpen = new Set(result.openSlots.map(occasionKey));

	for (const [key, row] of byOccasion) {
		if (stillScheduled.has(key)) continue;

		if (stillOpen.has(key)) {
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

	return {
		atRisk: describeAtRisk(db, atRisk),
		placementsMoved: describePlacementsMoved(db, resolvedCal, placements, result)
	};
}

// Every Class currently assigned this Topic — the Classes whose schedule a change to one of the
// Topic's Lessons touches. `placementsMoved` across every touched Class is folded into one
// combined report, same as rederivePlacementLesson below: a Class holding both this Topic and a
// Placement can have the Placement shift sideways when the Topic-Lesson stream in front of it
// changes shape.
export function rederiveTopic(db: Db, topicId: string, today: string): WriteReport {
	const classIds = db
		.select({ classId: schema.assignedTopic.classId })
		.from(schema.assignedTopic)
		.where(eq(schema.assignedTopic.topicId, topicId))
		.all()
		.map((row) => row.classId);

	return combineReports(classIds.map((classId) => rederive(db, classId, today)));
}

// Every Class currently holding a Placement of this Lesson — the placement-keyed mirror of
// rederiveTopic, for a Standalone Lesson a Length edit must still re-derive sideways (ADR-0022):
// a Standalone Lesson reaches a Class only through a Placement, never through assignedTopic, so
// there is no Topic to re-derive through. `placementsMoved` across every touched Class is folded
// into one combined report, the same shape `rederive` itself returns for one Class.
export function rederivePlacementLesson(db: Db, lessonId: string, today: string): WriteReport {
	const classIds = db
		.selectDistinct({ classId: schema.placement.classId })
		.from(schema.placement)
		.where(eq(schema.placement.lessonId, lessonId))
		.all()
		.map((row) => row.classId);

	return combineReports(classIds.map((classId) => rederive(db, classId, today)));
}

// Folds one WriteReport per Class into the single combined report every multi-Class re-derive
// (rederiveTopic, rederivePlacementLesson, rederiveAllClasses) returns.
function combineReports(reports: WriteReport[]): WriteReport {
	return {
		atRisk: reports.flatMap((r) => r.atRisk),
		placementsMoved: reports.flatMap((r) => r.placementsMoved)
	};
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

export interface AtRiskSession {
	classId: string;
	classLabel: string;
	date: string;
	period: number;
	lessonTitle: string;
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

// What every scheduling write answers in one call: the Rewind's report of noted Sessions whose
// Lesson the re-derivation changed, already named by Class and Lesson — the describing lives
// inside `rederive` so no caller can forget it. `placementsMoved` is the same idea for a
// Placement whose anchor a Blocked Day or Blocked Slot has pushed off — unconditional, unlike
// `atRisk`, since a Placement carries no note to make silence safe.
export type WriteReport = { atRisk: AtRiskSession[]; placementsMoved: PlacementMoved[] };

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

// A Rewind's report, made readable: each note-carrying Session whose Lesson changed, named by
// Class and Lesson rather than left as bare ids — what blockDay and blockSlot's `atRisk` is for
// (the point of the feature, not a nicety, per #38). Private by design: every write describes
// its own report before returning.
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

// A Placement's stored anchor, resolved to a Period via the Calendar's Slot table, compared
// against where its own emitted ScheduledSession actually lands — matched by the Placement's id,
// not its Lesson id alone, since the same Lesson may be placed twice on one Class. A Placement
// fully covered by history (nothing left to schedule this call) has no landing to compare against
// and is never reported: history is frozen, so it cannot have moved. A Placement in
// `strandedPlacementIds` has no landing for a different reason — every Slot at or after its
// anchor is gone — and is always reported, since silence there would be indistinguishable from
// "nothing changed".
function describePlacementsMoved(
	db: Db,
	cal: Calendar,
	placements: Placement[],
	result: ScheduleResult
): PlacementMoved[] {
	if (placements.length === 0) return [];

	const periodOf: Record<string, number> = Object.fromEntries(
		cal.slots.map((s) => [s.id, s.period])
	);

	const landing: Record<string, ScheduledSession> = {};
	for (const s of result.scheduled) {
		if (!s.placementId) continue;
		const earliest = landing[s.placementId];
		if (
			!earliest ||
			s.date < earliest.date ||
			(s.date === earliest.date && s.period < earliest.period)
		) {
			landing[s.placementId] = s;
		}
	}

	const stranded = new Set(result.strandedPlacementIds);
	const moved = placements.filter((p) => {
		const at = landing[p.id];
		return at !== undefined && (at.date !== p.date || at.period !== (periodOf[p.slotId] ?? 0));
	});
	const strandedPlacements = placements.filter((p) => stranded.has(p.id));
	const reported = [...moved, ...strandedPlacements];

	if (reported.length === 0) return [];

	const labels = new Map(
		db
			.select({ id: schema.classes.id, label: schema.classes.label })
			.from(schema.classes)
			.all()
			.map((row) => [row.id, row.label])
	);
	const names = lessonNames(
		db,
		reported.map((p) => p.lessonId)
	);

	return reported.map((p) => {
		const at = landing[p.id];
		const anchorPeriod = periodOf[p.slotId] ?? 0;
		return {
			placementId: p.id,
			classId: p.classId,
			classLabel: labels.get(p.classId) ?? p.classId,
			lessonTitle: names.get(p.lessonId)?.title ?? p.lessonId,
			anchorDate: p.date,
			anchorPeriod,
			date: at?.date ?? p.date,
			period: at?.period ?? anchorPeriod,
			...(at ? {} : { stranded: true })
		};
	});
}
