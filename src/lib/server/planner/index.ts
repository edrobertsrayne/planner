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
import { and, asc, eq, gte, lt } from 'drizzle-orm';
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
