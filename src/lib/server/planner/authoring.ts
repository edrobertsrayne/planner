// Authoring — the Courses view. A Course and a Topic are not themselves scheduling inputs, so
// creating or renaming one never re-derives. A Lesson is different: once its Topic is assigned to
// a Class, the Lesson is part of that Class's schedule, so every write to a Lesson re-derives
// every Class with that Topic assigned — quietly, on the same write, with no separate recompute
// step (issue #31).
import { and, asc, eq, lt } from 'drizzle-orm';
import * as schema from '../db/schema';
import { rederiveTopic, type Db } from './derive';
import { nextPosition, swapTargets, type Direction } from './ordering';

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

// Where a new Lesson lands in its Topic's order (ADR-0010: Lessons, unlike Topics, are explicitly
// ordered) — at the end, both for a new Lesson and for one moved in from another Topic.
const endOfTopic = (db: Db, topicId: string) =>
	nextPosition(
		db
			.select({ position: schema.lesson.position })
			.from(schema.lesson)
			.where(eq(schema.lesson.topicId, topicId))
			.all()
	);

// A title alone is a complete Lesson — no draft state, no required second field. Re-derives every
// Class already assigned this Topic, since a new Lesson changes what those Classes still have
// left to teach.
export function createLesson(
	db: Db,
	{ topicId, title, today }: { topicId: string; title: string; today: string }
) {
	const [row] = db
		.insert(schema.lesson)
		.values({ topicId, title, position: endOfTopic(db, topicId) })
		.returning()
		.all();
	rederiveTopic(db, topicId, today);
	return row;
}

export type LessonStatus = 'draft' | 'planned';

export function renameLesson(db: Db, { id, title }: { id: string; title: string }) {
	const [row] = db
		.update(schema.lesson)
		.set({ title })
		.where(eq(schema.lesson.id, id))
		.returning()
		.all();
	return row;
}

// Planning status is a fact about the Lesson (ADR-0014), shared by every Class assigned its Topic.
// Setting it never re-derives the schedule: a status says nothing about a date. It never touches Readiness.
export function setLessonStatus(
	db: Db,
	lessonId: string,
	status: LessonStatus
): typeof schema.lesson.$inferSelect | undefined;
export function setLessonStatus(
	db: Db,
	options: { id?: string; lessonId?: string; status: LessonStatus }
): typeof schema.lesson.$inferSelect | undefined;
export function setLessonStatus(
	db: Db,
	lessonIdOrOptions: string | { id?: string; lessonId?: string; status: LessonStatus },
	statusArg?: LessonStatus
) {
	const id =
		typeof lessonIdOrOptions === 'string'
			? lessonIdOrOptions
			: (lessonIdOrOptions.id ?? lessonIdOrOptions.lessonId!);
	const status = typeof lessonIdOrOptions === 'string' ? statusArg! : lessonIdOrOptions.status;

	const [row] = db
		.update(schema.lesson)
		.set({ status })
		.where(eq(schema.lesson.id, id))
		.returning()
		.all();
	return row;
}

// Readiness is recorded per Class and Lesson (ADR-0014).
// Ticking inserts the row, unticking deletes it; both idempotent. No re-derive.
export function setReadiness(db: Db, lessonId: string, classId: string, ready: boolean): void;
export function setReadiness(
	db: Db,
	options: { lessonId: string; classId: string; ready: boolean }
): void;
export function setReadiness(
	db: Db,
	lessonIdOrOptions: string | { lessonId: string; classId: string; ready: boolean },
	classIdArg?: string,
	readyArg?: boolean
) {
	const lessonId =
		typeof lessonIdOrOptions === 'string' ? lessonIdOrOptions : lessonIdOrOptions.lessonId;
	const classId = typeof lessonIdOrOptions === 'string' ? classIdArg! : lessonIdOrOptions.classId;
	const ready = typeof lessonIdOrOptions === 'string' ? readyArg! : lessonIdOrOptions.ready;

	if (ready) {
		db.insert(schema.readiness).values({ lessonId, classId }).onConflictDoNothing().run();
	} else {
		db.delete(schema.readiness)
			.where(and(eq(schema.readiness.lessonId, lessonId), eq(schema.readiness.classId, classId)))
			.run();
	}
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

// Length is a scheduling input, so this re-derives every Class assigned this Lesson's
// Topic from `today`. Title and body are cosmetic and never move a date, but re-deriving
// regardless is harmless — `rederive` only writes where something actually changed.
export function updateLesson(
	db: Db,
	{
		id,
		title,
		body,
		length,
		today
	}: { id: string; title: string; body: string | null; length: number; today: string }
) {
	const [row] = db
		.update(schema.lesson)
		.set({ title, body, length })
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

	if (classesTaughtLesson(db, { lessonId: id, today }).length > 0) {
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
	}: { topicId: string; id: string; direction: Direction; today: string }
) {
	const swap = swapTargets(lessonsOf(db, topicId), id, direction);
	if (!swap) return;

	const [a, b] = swap;
	db.update(schema.lesson).set({ position: b.position }).where(eq(schema.lesson.id, a.id)).run();
	db.update(schema.lesson).set({ position: a.position }).where(eq(schema.lesson.id, b.id)).run();

	rederiveTopic(db, topicId, today);
}

// Moves a Lesson to a different Topic, keeping its body, links and Length — appended at
// the end of the new Topic's order. Re-derives every Class assigned either Topic: the old one
// lost a Lesson, the new one gained one.
export function moveLessonToTopic(
	db: Db,
	{ id, topicId, today }: { id: string; topicId: string; today: string }
) {
	const [row] = db.select().from(schema.lesson).where(eq(schema.lesson.id, id)).all();
	if (!row) return null;
	const oldTopicId = row.topicId;

	const [updated] = db
		.update(schema.lesson)
		.set({ topicId, position: endOfTopic(db, topicId) })
		.where(eq(schema.lesson.id, id))
		.returning()
		.all();

	rederiveTopic(db, oldTopicId, today);
	if (topicId !== oldTopicId) rederiveTopic(db, topicId, today);
	return updated;
}

// Which Classes have already been taught this Lesson, before `today` — the taught-by block in
// the Lesson editor, so Ed knows an edit here touches a plan already in use, and what makes
// deleteLesson refuse.
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
	const position = nextPosition(
		db
			.select({ position: schema.link.position })
			.from(schema.link)
			.where(eq(schema.link.lessonId, lessonId))
			.all()
	);

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
	{ lessonId, id, direction }: { lessonId: string; id: string; direction: Direction }
) {
	const swap = swapTargets(linksOf(db, lessonId), id, direction);
	if (!swap) return;

	const [a, b] = swap;
	db.update(schema.link).set({ position: b.position }).where(eq(schema.link.id, a.id)).run();
	db.update(schema.link).set({ position: a.position }).where(eq(schema.link.id, b.id)).run();
}
