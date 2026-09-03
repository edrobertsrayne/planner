// Authoring — the Courses view. A Course and a Topic are not themselves scheduling inputs, so
// creating or renaming one never re-derives. A Lesson is different: once its Topic is assigned to
// a Class, the Lesson is part of that Class's schedule, so every write to a Lesson re-derives
// every Class with that Topic assigned — quietly, on the same write, with no separate recompute
// step (issue #31).
import { and, asc, eq, lt, sql } from 'drizzle-orm';
import type { Database } from 'bun:sqlite';
import * as schema from '../db/schema';
import { inTransaction } from '../db';
import { rederiveTopic, type Db } from './derive';
import { attachmentsOf } from './attachments';
import { nextPosition, swapTargets, type Direction } from './ordering';

// Course and Topic names carry an explicit uniqueness rule (issue #131, §6 of the planning API
// spec). The database indexes are the guard of last resort — every route handler maps a collision
// here into a readable 4xx — so the seam refuses the write first and never lets a raw
// SQLITE_CONSTRAINT reach the user.
export class NameCollision extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'NameCollision';
	}
}

// "Forces" and "forces" collide; "  Forces  " and "Forces" collide too. Stored values are trimmed
// at write time, but a row that pre-dates this ticket may still hold surrounding whitespace, so
// the comparison normalises both sides.
function nameMatchesIgnoringCaseAndWhitespace(stored: string, attempted: string): boolean {
	return stored.trim().toLowerCase() === attempted.trim().toLowerCase();
}

// A Course is refused on create or rename if any other Course — case-insensitive, trimmed — already
// holds the name. The seam throws with the message already written for the teacher to read; the
// form action maps it to a 4xx with no further work. The thrown message embeds the *trimmed*
// stored name, never its surrounding whitespace.
function assertCourseNameAvailable(
	db: Db,
	{ name, exceptId }: { name: string; exceptId?: string }
) {
	const trimmed = name.trim();
	const rows = db
		.select({ id: schema.course.id, name: schema.course.name })
		.from(schema.course)
		.where(
			exceptId
				? sql`${schema.course.id} != ${exceptId} AND lower(${schema.course.name}) = lower(${trimmed})`
				: sql`lower(${schema.course.name}) = lower(${trimmed})`
		)
		.all();
	const collision = rows.find((row) => nameMatchesIgnoringCaseAndWhitespace(row.name, name));
	if (collision) {
		throw new NameCollision(`A Course called "${collision.name.trim()}" already exists.`);
	}
}

// The Topic-name-collision query, shared by the refusing form (assertTopicNameAvailable, used by
// create/rename) and the reporting form (importTopic, which turns a collision into a 409 instead
// of a throw). Two Courses may each hold a "Forces", so the check is scoped to course_id.
function findTopicNameCollision(
	db: Db,
	{ courseId, name, exceptId }: { courseId: string; name: string; exceptId?: string }
) {
	const trimmed = name.trim();
	const rows = db
		.select({ id: schema.topic.id, name: schema.topic.name })
		.from(schema.topic)
		.where(
			and(
				eq(schema.topic.courseId, courseId),
				exceptId
					? sql`${schema.topic.id} != ${exceptId} AND lower(${schema.topic.name}) = lower(${trimmed})`
					: sql`lower(${schema.topic.name}) = lower(${trimmed})`
			)
		)
		.all();
	return rows.find((row) => nameMatchesIgnoringCaseAndWhitespace(row.name, name));
}

// A Topic is refused on create or rename if the same Course already holds a Topic of that name.
function assertTopicNameAvailable(
	db: Db,
	{ courseId, name, exceptId }: { courseId: string; name: string; exceptId?: string }
) {
	const collision = findTopicNameCollision(db, { courseId, name, exceptId });
	if (collision) {
		throw new NameCollision(`This Course already has a Topic called "${collision.name.trim()}".`);
	}
}

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
	const trimmed = name.trim();
	assertCourseNameAvailable(db, { name: trimmed });
	const [row] = db.insert(schema.course).values({ name: trimmed }).returning().all();
	return row;
}

export function renameCourse(db: Db, { id, name }: { id: string; name: string }) {
	const trimmed = name.trim();
	assertCourseNameAvailable(db, { name: trimmed, exceptId: id });
	const [row] = db
		.update(schema.course)
		.set({ name: trimmed })
		.where(eq(schema.course.id, id))
		.returning()
		.all();
	return row;
}

// Whether cascading into this Topic is blocked by something a confirmed delete cannot override:
// the Topic assigned to a Class, or one of its Lessons already taught. Shared by deleteTopic's
// own guard and deleteCourse's pre-flight over every Topic it is about to cascade into — checked
// before either ever asks for confirmation, so a delete that can never succeed says so at once.
function topicCascadeBlocker(db: Db, topicId: string, today: string): 'assigned' | 'taught' | null {
	const assigned = db
		.select({ id: schema.assignedTopic.id })
		.from(schema.assignedTopic)
		.where(eq(schema.assignedTopic.topicId, topicId))
		.all();
	if (assigned.length > 0) return 'assigned';

	const taught = lessonsOf(db, topicId).some(
		(lesson) => classesTaughtLesson(db, { lessonId: lesson.id, today }).length > 0
	);
	if (taught) return 'taught';

	return null;
}

// A Course with no Topics goes at once, same as today. A Course that still holds Topics is
// refused until the caller confirms (issue: Course/Topic delete parity with Lesson delete) —
// then every Topic, and every Lesson each holds, goes with it. A Class following the Course, or
// a Topic anywhere underneath that is assigned to a Class or holds an already-taught Lesson,
// refuses unconditionally: confirming never overrides those.
export function deleteCourse(
	db: Db,
	id: string,
	{ today, confirmed = false }: { today: string; confirmed?: boolean }
): { ok: false; reason: string; needsConfirm: boolean } | { ok: true } {
	const [course] = db.select().from(schema.course).where(eq(schema.course.id, id)).all();
	if (!course) return { ok: false, reason: 'not found', needsConfirm: false };

	const classes = db
		.select({ id: schema.classes.id })
		.from(schema.classes)
		.where(eq(schema.classes.courseId, id))
		.all();
	if (classes.length > 0) {
		return {
			ok: false,
			reason: 'A Class follows this Course, so it cannot be removed.',
			needsConfirm: false
		};
	}

	const topics = topicsOf(db, id);
	for (const topic of topics) {
		const blocker = topicCascadeBlocker(db, topic.id, today);
		if (blocker === 'assigned') {
			return {
				ok: false,
				reason: 'A Topic in this Course is assigned to a Class, so it cannot be removed.',
				needsConfirm: false
			};
		}
		if (blocker === 'taught') {
			return {
				ok: false,
				reason:
					'A Topic in this Course holds a Lesson that has already been taught, so it cannot be removed.',
				needsConfirm: false
			};
		}
	}

	if (topics.length > 0) {
		if (!confirmed) {
			return {
				ok: false,
				reason: 'This Course still holds Topics. Remove them first.',
				needsConfirm: true
			};
		}
		for (const topic of topics) {
			const result = deleteTopic(db, topic.id, { today, confirmed: true });
			if (!result.ok) return result;
		}
	}

	db.delete(schema.course).where(eq(schema.course.id, id)).run();
	return { ok: true };
}

export function createTopic(db: Db, { courseId, name }: { courseId: string; name: string }) {
	const trimmed = name.trim();
	assertTopicNameAvailable(db, { courseId, name: trimmed });
	const [row] = db.insert(schema.topic).values({ courseId, name: trimmed }).returning().all();
	return row;
}

export function renameTopic(db: Db, { id, name }: { id: string; name: string }) {
	const [existing] = db.select().from(schema.topic).where(eq(schema.topic.id, id)).all();
	if (!existing) return undefined;
	const trimmed = name.trim();
	assertTopicNameAvailable(db, {
		courseId: existing.courseId,
		name: trimmed,
		exceptId: id
	});
	const [row] = db
		.update(schema.topic)
		.set({ name: trimmed })
		.where(eq(schema.topic.id, id))
		.returning()
		.all();
	return row;
}

// A Topic with no Lessons goes at once, same as today. A Topic that still holds Lessons is
// refused until the caller confirms — then every Lesson it holds goes with it, the same way
// deleteLesson would remove each on its own. Assigned to a Class, or holding an already-taught
// Lesson, refuses unconditionally: confirming never overrides those.
export function deleteTopic(
	db: Db,
	id: string,
	{ today, confirmed = false }: { today: string; confirmed?: boolean }
): { ok: false; reason: string; needsConfirm: boolean } | { ok: true } {
	const [topic] = db.select().from(schema.topic).where(eq(schema.topic.id, id)).all();
	if (!topic) return { ok: false, reason: 'not found', needsConfirm: false };

	const blocker = topicCascadeBlocker(db, id, today);
	if (blocker === 'assigned') {
		return {
			ok: false,
			reason: 'This Topic is assigned to a Class, so it cannot be removed.',
			needsConfirm: false
		};
	}
	if (blocker === 'taught') {
		return {
			ok: false,
			reason: 'This Topic holds a Lesson that has already been taught, so it cannot be removed.',
			needsConfirm: false
		};
	}

	const lessons = lessonsOf(db, id);
	if (lessons.length > 0) {
		if (!confirmed) {
			return {
				ok: false,
				reason: 'This Topic still holds Lessons. Remove or detach them first.',
				needsConfirm: true
			};
		}
		for (const lesson of lessons) deleteLesson(db, { id: lesson.id, today });
	}

	db.delete(schema.topic).where(eq(schema.topic.id, id)).run();
	return { ok: true };
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
	{
		topicId,
		title,
		body,
		length,
		status,
		today
	}: {
		topicId: string;
		title: string;
		body?: string | null;
		length?: number;
		status?: 'draft' | 'planned';
		today: string;
	}
) {
	const [row] = db
		.insert(schema.lesson)
		.values({
			topicId,
			title,
			position: endOfTopic(db, topicId),
			...(body !== undefined ? { body } : {}),
			...(length !== undefined ? { length } : {}),
			...(status !== undefined ? { status } : {})
		})
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
): typeof schema.lesson.$inferSelect | undefined {
	const [row] = db
		.update(schema.lesson)
		.set({ status })
		.where(eq(schema.lesson.id, lessonId))
		.returning()
		.all();
	return row;
}

// Readiness is recorded per Class and Lesson (ADR-0014).
// Ticking inserts the row, unticking deletes it; both idempotent. No re-derive.
export function setReadiness(db: Db, lessonId: string, classId: string, ready: boolean): void {
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

// The Lesson editor's one full-detail read: the Lesson plus its Links and its Attachments, each
// in position order.
export function lessonDetail(db: Db, id: string) {
	const [row] = db.select().from(schema.lesson).where(eq(schema.lesson.id, id)).all();
	if (!row) return null;
	return { ...row, links: linksOf(db, id), attachments: attachmentsOf(db, id) };
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
	if (row.topicId) rederiveTopic(db, row.topicId, today);
	return row;
}

// Removes a Lesson entirely, along with its Links, and re-derives every Class assigned its
// Topic. Refuses when a Class has already been taught this Lesson: the historical Session rows
// reference it (ADR-0002), so deleting it would erase part of the record of what happened —
// the taught-by block in the Lesson editor is what warns Ed before he tries this and it fails.
export function deleteLesson(
	db: Db,
	{ id, today }: { id: string; today: string }
):
	| { ok: false; reason: 'not found' }
	| { ok: false; reason: 'taught' }
	| { ok: true; lesson: typeof schema.lesson.$inferSelect } {
	const [row] = db.select().from(schema.lesson).where(eq(schema.lesson.id, id)).all();
	if (!row) return { ok: false, reason: 'not found' };

	if (classesTaughtLesson(db, { lessonId: id, today }).length > 0) {
		return { ok: false, reason: 'taught' };
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

	db.delete(schema.readiness).where(eq(schema.readiness.lessonId, id)).run();
	db.delete(schema.link).where(eq(schema.link.lessonId, id)).run();
	db.delete(schema.lesson).where(eq(schema.lesson.id, id)).run();

	if (row.topicId) rederiveTopic(db, row.topicId, today);
	return { ok: true, lesson: row };
}

// Partial PATCH for the API. Only the fields present in `fields` change; absent fields leave
// their values alone. Re-derives every Class assigned the Topic if anything scheduling-relevant
// changed, or if the Lesson moved to a different Topic.
export function patchLesson(
	db: Db,
	{
		id,
		fields,
		today
	}: {
		id: string;
		fields: {
			title?: string;
			body?: string | null;
			length?: number;
			status?: 'draft' | 'planned';
			topicId?: string | null;
		};
		today: string;
	}
):
	| { ok: true; lesson: typeof schema.lesson.$inferSelect }
	| { ok: false; reason: 'not found' | 'topic not found' } {
	const [row] = db.select().from(schema.lesson).where(eq(schema.lesson.id, id)).all();
	if (!row) return { ok: false, reason: 'not found' };

	const update: Record<string, unknown> = {};

	if (fields.title !== undefined) update.title = fields.title;
	if (fields.body !== undefined) update.body = fields.body;
	if (fields.length !== undefined) update.length = fields.length;
	if (fields.status !== undefined) update.status = fields.status;

	const oldTopicId = row.topicId;
	const newTopicId = fields.topicId;

	if (newTopicId !== undefined && newTopicId !== null && newTopicId !== oldTopicId) {
		const [existing] = db.select().from(schema.topic).where(eq(schema.topic.id, newTopicId)).all();
		if (!existing) return { ok: false, reason: 'topic not found' };
		update.topicId = newTopicId;
		// A re-attach or move lands at the end of the target Topic's order, as moveLessonToTopic
		// does — a Lesson carries no position of its own into a Topic it has never been in.
		update.position = endOfTopic(db, newTopicId);
	} else if (newTopicId === null && newTopicId !== oldTopicId) {
		update.topicId = null;
	}

	if (Object.keys(update).length === 0 && newTopicId === undefined)
		return { ok: true, lesson: row };

	db.update(schema.lesson)
		.set(update as Partial<typeof schema.lesson.$inferInsert>)
		.where(eq(schema.lesson.id, id))
		.run();

	const [updated] = db.select().from(schema.lesson).where(eq(schema.lesson.id, id)).all();
	if (!updated) return { ok: false, reason: 'not found' };

	if (newTopicId !== undefined && newTopicId !== oldTopicId) {
		if (oldTopicId) rederiveTopic(db, oldTopicId, today);
		if (newTopicId) rederiveTopic(db, newTopicId, today);
	} else if (
		updated.topicId &&
		(fields.length !== undefined || fields.title !== undefined || fields.body !== undefined)
	) {
		rederiveTopic(db, updated.topicId, today);
	}

	return { ok: true, lesson: updated };
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
	{ id, topicId, today }: { id: string; topicId: string | null; today: string }
) {
	const [row] = db.select().from(schema.lesson).where(eq(schema.lesson.id, id)).all();
	if (!row) return null;
	const oldTopicId = row.topicId;

	const [updated] = db
		.update(schema.lesson)
		.set({
			topicId,
			...(topicId !== null ? { position: endOfTopic(db, topicId) } : {})
		})
		.where(eq(schema.lesson.id, id))
		.returning()
		.all();

	if (oldTopicId) rederiveTopic(db, oldTopicId, today);
	if (topicId && topicId !== oldTopicId) rederiveTopic(db, topicId, today);
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

// A refusal the Import has already decided on — a Course that is not there, a Topic name that
// collides. Thrown rather than returned so the transaction helper rolls the write back on the
// way out; importTopic catches it and answers with the status it carries.
class Refused extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
		this.name = 'Refused';
	}
}

export function importTopic(
	db: Db,
	client: Database,
	{
		courseId,
		courseName,
		topicName,
		lessons
	}: {
		courseId?: string;
		courseName?: string;
		topicName: string;
		lessons: Array<{
			title: string;
			body?: string | null;
			length?: number;
			status?: 'draft' | 'planned';
			links?: Array<{ url: string; label: string }>;
		}>;
	},
	today: string
):
	| {
			ok: true;
			course: { id: string; name: string };
			courseCreated: boolean;
			topic: { id: string; name: string; courseId: string };
			lessons: Array<{
				id: string;
				title: string;
				position: number;
				links: Array<{ id: string; url: string; label: string; position: number }>;
			}>;
	  }
	| { ok: false; status: number; error: string; cause?: unknown } {
	if (courseId && courseName)
		return {
			ok: false,
			status: 400,
			error: 'The "course" field must carry exactly one of "id" or "name".'
		};
	if (!courseId && !courseName)
		return {
			ok: false,
			status: 400,
			error: 'The "course" field must carry exactly one of "id" or "name".'
		};

	if (lessons.length > 200)
		return { ok: false, status: 400, error: 'At most 200 Lessons per Import.' };

	for (const lesson of lessons) {
		if (lesson.links && lesson.links.length > 20) {
			return { ok: false, status: 400, error: 'At most 20 Links per Lesson.' };
		}
	}

	try {
		return inTransaction(client, () => {
			let resolvedCourseId = courseId;
			let courseCreated = false;

			if (courseName) {
				const trimmed = courseName.trim();
				const [existing] = db
					.select({ id: schema.course.id, name: schema.course.name })
					.from(schema.course)
					.where(sql`lower(${schema.course.name}) = lower(${trimmed})`)
					.all();
				if (existing) {
					resolvedCourseId = existing.id;
				} else {
					const [created] = db.insert(schema.course).values({ name: trimmed }).returning().all();
					resolvedCourseId = created.id;
					courseCreated = true;
				}
			}

			if (!resolvedCourseId) throw new Refused(404, 'Course not found.');

			const courseRecord = db
				.select({ id: schema.course.id, name: schema.course.name })
				.from(schema.course)
				.where(eq(schema.course.id, resolvedCourseId))
				.all()[0];
			if (!courseRecord) throw new Refused(404, 'Course not found.');

			const trimmedTopicName = topicName.trim();
			const topicCollision = findTopicNameCollision(db, {
				courseId: resolvedCourseId,
				name: topicName
			});
			if (topicCollision) {
				throw new Refused(
					409,
					`The Course "${courseRecord.name}" already holds a Topic called "${topicCollision.name.trim()}".`
				);
			}

			const [topicRow] = db
				.insert(schema.topic)
				.values({ name: trimmedTopicName, courseId: resolvedCourseId })
				.returning()
				.all();

			const lessonResults: Array<{
				id: string;
				title: string;
				position: number;
				links: Array<{ id: string; url: string; label: string; position: number }>;
			}> = [];

			for (let i = 0; i < lessons.length; i++) {
				const lesson = lessons[i];
				const [lessonRow] = db
					.insert(schema.lesson)
					.values({
						topicId: topicRow.id,
						title: lesson.title.trim(),
						position: i,
						...(lesson.body !== undefined ? { body: lesson.body } : {}),
						...(lesson.length !== undefined ? { length: lesson.length } : {}),
						...(lesson.status !== undefined ? { status: lesson.status } : {})
					})
					.returning()
					.all();

				const linkResults: Array<{
					id: string;
					url: string;
					label: string;
					position: number;
				}> = [];
				if (lesson.links) {
					for (let j = 0; j < lesson.links.length; j++) {
						const link = lesson.links[j];
						const [linkRow] = db
							.insert(schema.link)
							.values({
								lessonId: lessonRow.id,
								url: link.url.trim(),
								label: link.label.trim(),
								position: j
							})
							.returning()
							.all();
						linkResults.push({
							id: linkRow.id,
							url: linkRow.url,
							label: linkRow.label,
							position: linkRow.position
						});
					}
				}

				lessonResults.push({
					id: lessonRow.id,
					title: lessonRow.title,
					position: lessonRow.position,
					links: linkResults
				});
			}

			rederiveTopic(db, topicRow.id, today);

			return {
				ok: true,
				course: { id: courseRecord.id, name: courseRecord.name },
				courseCreated,
				topic: { id: topicRow.id, name: topicRow.name, courseId: topicRow.courseId },
				lessons: lessonResults
			};
		});
	} catch (cause) {
		if (cause instanceof Refused) {
			return { ok: false, status: cause.status, error: cause.message };
		}
		return { ok: false, status: 500, error: 'Import failed.', cause };
	}
}
