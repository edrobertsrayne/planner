// Authoring — the Courses view. A Course and a Topic are not themselves scheduling inputs, so
// creating or renaming one never re-derives. A Lesson is different: once its Topic is assigned to
// a Class, the Lesson is part of that Class's schedule, so every write to its place or Length
// re-derives every Class that reaches it — quietly, on the same write, with no separate
// recompute step (issue #31).
import { and, asc, eq, inArray, lt, notInArray, sql } from 'drizzle-orm';
import type { Database } from 'bun:sqlite';
import { nextTone } from '$lib/class-tone';
import * as schema from '../db/schema';
import { inTransaction } from '../db';
import { combineReports, rederive, rederiveTopic, type Db, type WriteReport } from './derive';
import { nextPosition, swapTargets, type Direction } from './ordering';
import { deleteAttachmentsOfLesson } from './attachments';
import { Refused } from './refused';
import { lessonBody, lessonLength, lessonStatus, linkUrl, required } from './fields';

// Course and Topic names carry an explicit uniqueness rule (issue #131, §6 of the planning API
// spec). The database indexes are the guard of last resort — so the seam refuses the write first
// and never lets a raw SQLITE_CONSTRAINT reach the user. A collision is a `conflict`: the request
// was well-formed and answered with its real outcome.

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
		throw new Refused('conflict', `A Course called "${collision.name.trim()}" already exists.`);
	}
}

// The Topic-name-collision query, shared by the refusing writes (assertTopicNameAvailable, used
// by create/rename) and importTopic. Two Courses may each hold a "Forces", so the check is
// scoped to course_id.
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
		throw new Refused(
			'conflict',
			`This Course already has a Topic called "${collision.name.trim()}".`
		);
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

// What the Course page shows beside the Topics: how many Lessons each Topic holds, and the
// Classes that follow the Course, by label.
export function courseSummary(db: Db, courseId: string) {
	const counts = db
		.select({ topicId: schema.lesson.topicId, count: sql<number>`count(*)` })
		.from(schema.lesson)
		.innerJoin(schema.topic, eq(schema.topic.id, schema.lesson.topicId))
		.where(eq(schema.topic.courseId, courseId))
		.groupBy(schema.lesson.topicId)
		.all();
	const classes = db
		.select({ id: schema.classes.id, label: schema.classes.label })
		.from(schema.classes)
		.where(eq(schema.classes.courseId, courseId))
		.orderBy(asc(schema.classes.label))
		.all();
	return { lessonCounts: new Map(counts.map((c) => [c.topicId, c.count])), classes };
}

// What the Courses screen shows for each Course: counts and the Classes that teach it.
export function courseTiles(db: Db) {
	const topicCounts = new Map(
		db
			.select({ courseId: schema.topic.courseId, n: sql<number>`count(*)` })
			.from(schema.topic)
			.groupBy(schema.topic.courseId)
			.all()
			.map((r) => [r.courseId, r.n])
	);
	const lessonCounts = new Map(
		db
			.select({
				courseId: schema.topic.courseId,
				n: sql<number>`count(*)`,
				planned: sql<number>`sum(${schema.lesson.status} = 'planned')`
			})
			.from(schema.lesson)
			.innerJoin(schema.topic, eq(schema.topic.id, schema.lesson.topicId))
			.groupBy(schema.topic.courseId)
			.all()
			.map((r) => [r.courseId, r])
	);
	const classLabels = db
		.select({ courseId: schema.classes.courseId, label: schema.classes.label })
		.from(schema.classes)
		.orderBy(asc(schema.classes.label))
		.all();
	return listCourses(db).map((course) => ({
		...course,
		topicCount: topicCounts.get(course.id) ?? 0,
		lessonCount: lessonCounts.get(course.id)?.n ?? 0,
		plannedCount: lessonCounts.get(course.id)?.planned ?? 0,
		classes: classLabels.filter((c) => c.courseId === course.id).map((c) => c.label)
	}));
}

// A Course's Tone is assigned once, at creation: the next unused position of the same walk a
// Class uses (ADR-0013), walked over Courses only. Nothing else writes it.
function nextCourseTone(db: Db) {
	return nextTone(
		db
			.select({ tone: schema.course.tone })
			.from(schema.course)
			.all()
			.map((row) => row.tone)
	);
}

export function createCourse(db: Db, { name }: { name: string }) {
	const trimmed = required(name, 'A Course needs a name.');
	assertCourseNameAvailable(db, { name: trimmed });
	const [row] = db
		.insert(schema.course)
		.values({ name: trimmed, tone: nextCourseTone(db) })
		.returning()
		.all();
	return row;
}

export function renameCourse(db: Db, { id, name }: { id: string; name: string }) {
	const trimmed = required(name, 'A Course needs a name.');
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
//
// The confirm question is a return, not a throw — it is a question the form answers with
// `confirmed=true`, not a refusal. An unknown id returns undefined, the door's 404; every other
// refusal throws `Refused`.
export function deleteCourse(
	db: Db,
	id: string,
	{ today, confirmed = false, dir }: { today: string; confirmed?: boolean; dir: string }
): typeof schema.course.$inferSelect | { needsConfirm: true; reason: string } | undefined {
	const [course] = db.select().from(schema.course).where(eq(schema.course.id, id)).all();
	if (!course) return undefined;

	const classes = db
		.select({ id: schema.classes.id })
		.from(schema.classes)
		.where(eq(schema.classes.courseId, id))
		.all();
	if (classes.length > 0) {
		throw new Refused('conflict', 'A Class follows this Course, so it cannot be removed.');
	}

	const topics = topicsOf(db, id);
	for (const topic of topics) {
		const blocker = topicCascadeBlocker(db, topic.id, today);
		if (blocker === 'assigned') {
			throw new Refused(
				'conflict',
				'A Topic in this Course is assigned to a Class, so it cannot be removed.'
			);
		}
		if (blocker === 'taught') {
			throw new Refused(
				'conflict',
				'A Topic in this Course holds a Lesson that has already been taught, so it cannot be removed.'
			);
		}
	}

	if (topics.length > 0) {
		if (!confirmed) {
			return {
				needsConfirm: true,
				reason: 'This Course still holds Topics. Remove them first.'
			};
		}
		for (const topic of topics) deleteTopic(db, topic.id, { today, confirmed: true, dir });
	}

	const [deleted] = db.delete(schema.course).where(eq(schema.course.id, id)).returning().all();
	return deleted;
}

export function createTopic(db: Db, { courseId, name }: { courseId: string; name: string }) {
	const trimmed = required(name, 'A Topic needs a name.');
	assertTopicNameAvailable(db, { courseId, name: trimmed });
	const [row] = db.insert(schema.topic).values({ courseId, name: trimmed }).returning().all();
	return row;
}

export function renameTopic(db: Db, { id, name }: { id: string; name: string }) {
	const [existing] = db.select().from(schema.topic).where(eq(schema.topic.id, id)).all();
	if (!existing) return undefined;
	const trimmed = required(name, 'A Topic needs a name.');
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
//
// The confirm question is a return, not a throw — it is a question the form answers with
// `confirmed=true`, not a refusal. An unknown id returns undefined, the door's 404; every other
// refusal throws `Refused`.
export function deleteTopic(
	db: Db,
	id: string,
	{ today, confirmed = false, dir }: { today: string; confirmed?: boolean; dir: string }
): typeof schema.topic.$inferSelect | { needsConfirm: true; reason: string } | undefined {
	const [topic] = db.select().from(schema.topic).where(eq(schema.topic.id, id)).all();
	if (!topic) return undefined;

	const blocker = topicCascadeBlocker(db, id, today);
	if (blocker === 'assigned') {
		throw new Refused('conflict', 'This Topic is assigned to a Class, so it cannot be removed.');
	}
	if (blocker === 'taught') {
		throw new Refused(
			'conflict',
			'This Topic holds a Lesson that has already been taught, so it cannot be removed.'
		);
	}

	const lessons = lessonsOf(db, id);
	if (lessons.length > 0) {
		if (!confirmed) {
			return {
				needsConfirm: true,
				reason: 'This Topic still holds Lessons. Remove or detach them first.'
			};
		}
		for (const lesson of lessons) deleteLesson(db, { id: lesson.id, today, dir });
	}

	const [deleted] = db.delete(schema.topic).where(eq(schema.topic.id, id)).returning().all();
	return deleted;
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
		status?: string;
		today: string;
	}
) {
	const [row] = db
		.insert(schema.lesson)
		.values({
			topicId,
			title: required(title, 'A Lesson needs a title.'),
			position: endOfTopic(db, topicId),
			...(body !== undefined ? { body: lessonBody(body) } : {}),
			...(length !== undefined ? { length: lessonLength(length) } : {}),
			...(status !== undefined ? { status: lessonStatus(status) } : {})
		})
		.returning()
		.all();
	rederiveTopic(db, topicId, today);
	return row;
}

export type LessonStatus = 'draft' | 'planned';

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

// Same rows as attachedTags, names only — every Lesson-showing read outside the editor itself
// (the editor needs attachedTags's ids to post to detachTag).
export function tagsOf(db: Db, lessonId: string): string[] {
	return attachedTags(db, lessonId).map((tag) => tag.name);
}

// Same rows as tagsOf, but carrying each Tag's id alongside its name — the Lesson editor's chip
// list, which needs an id to post to detachTag. Every other Lesson-showing read is names only
// (per the spec: tags are read-at-a-glance, never addressed by id outside the editor itself).
export function attachedTags(db: Db, lessonId: string): { id: string; name: string }[] {
	return db
		.select({ id: schema.tag.id, name: schema.tag.name })
		.from(schema.lessonTag)
		.innerJoin(schema.tag, eq(schema.tag.id, schema.lessonTag.tagId))
		.where(eq(schema.lessonTag.lessonId, lessonId))
		.orderBy(asc(schema.tag.name))
		.all();
}

// Batch form of tagsOf, for a row of Lessons rendered together — the Agenda, Planning and the
// Courses list each resolve every Lesson's Tags in one query rather than one per row, mirroring
// derive.ts's lessonNames. Lives here, not in derive.ts, because Tag is authored from this module;
// re-exported through the barrel for views.ts to import, the same way views.ts already imports
// LessonStatus from authoring.ts.
export function tagsByLesson(db: Db, lessonIds: readonly string[]): Map<string, string[]> {
	const map = new Map<string, string[]>();
	if (lessonIds.length === 0) return map;

	const rows = db
		.select({ lessonId: schema.lessonTag.lessonId, name: schema.tag.name })
		.from(schema.lessonTag)
		.innerJoin(schema.tag, eq(schema.tag.id, schema.lessonTag.tagId))
		.where(inArray(schema.lessonTag.lessonId, lessonIds))
		.orderBy(asc(schema.tag.name))
		.all();

	for (const row of rows) {
		const existing = map.get(row.lessonId);
		if (existing) existing.push(row.name);
		else map.set(row.lessonId, [row.name]);
	}
	return map;
}

// Every distinct Tag name that exists, sorted — the Lesson editor's typing suggestions, so a
// teacher reaching for "Practical" a second time sees it rather than retyping it slightly
// differently.
export function listTagNames(db: Db): string[] {
	return db
		.select({ name: schema.tag.name })
		.from(schema.tag)
		.orderBy(asc(schema.tag.name))
		.all()
		.map((row) => row.name);
}

// Tag names are unique across the planner, case-insensitive and trimmed (mirrors
// assertCourseNameAvailable's comparison via nameMatchesIgnoringCaseAndWhitespace). Typing a name
// that matches an existing Tag reuses it — attach, never create-or-refuse, is Tag's whole point.
// Finds a Tag matching trimmed + case-insensitive, reusing it, or creates one. Then inserts
// lesson_tag (idempotent on the composite key — INSERT OR IGNORE). Refuses an empty/whitespace-only
// name the same way editLesson refuses an empty title — an `invalid`, the one input the seam
// itself refuses. No re-derive: a Tag is descriptive metadata, exactly like Readiness, and never
// changes a date.
export function attachTag(
	db: Db,
	{ lessonId, name }: { lessonId: string; name: string }
): string[] {
	const trimmed = name.trim();
	if (!trimmed) throw new Refused('invalid', 'A Tag needs a name.');

	const [existing] = db
		.select()
		.from(schema.tag)
		.where(sql`lower(${schema.tag.name}) = lower(${trimmed})`)
		.all();
	const tagRow = existing ?? db.insert(schema.tag).values({ name: trimmed }).returning().all()[0];

	db.insert(schema.lessonTag).values({ lessonId, tagId: tagRow.id }).onConflictDoNothing().run();

	return tagsOf(db, lessonId);
}

// Deletes the one lesson_tag row. Idempotent: detaching a Tag the Lesson doesn't carry is a
// no-op, not an error, the same way unblocking an already-open day is.
export function detachTag(db: Db, { lessonId, tagId }: { lessonId: string; tagId: string }): void {
	db.delete(schema.lessonTag)
		.where(and(eq(schema.lessonTag.lessonId, lessonId), eq(schema.lessonTag.tagId, tagId)))
		.run();
}

// The Lesson editor's full-detail read: the Lesson plus its Links, in position order. The page
// loads compose Attachments onto this, and the bearer-key API does the same in its GET route.
export function lessonDetail(db: Db, id: string) {
	const [row] = db.select().from(schema.lesson).where(eq(schema.lesson.id, id)).all();
	if (!row) return null;
	return { ...row, links: linksOf(db, id), tags: tagsOf(db, id) };
}

// One change to one Lesson. The change names any of title, body, Length, status and Topic; a field
// it does not name keeps its value, and a `null` Topic is Detach. Every door that writes a Lesson
// calls this, so the Lesson editor and the API give the same answer to the same change (#356).
export type LessonChange = {
	title?: string;
	body?: string | null;
	length?: number;
	status?: string;
	topicId?: string | null;
};

// The rules for the change, all here:
// - The field rules in fields.ts run on each field the change names.
// - A Topic the change names but the database does not hold is `missing`. The check comes first,
//   so an unknown `topicId` answers 404 whatever the Lesson's own Topic (spec §3.4).
// - Detach is one-way (ADR-0022): a Standalone Lesson never rejoins a Topic, a `conflict`.
// - A move lands at the end of the new Topic's order: the Lesson has no position there yet.
// - A change that sets nothing writes nothing and reports nothing.
// - Length and Topic are scheduling inputs. A change to either re-derives every Class that reaches
//   the Lesson, before or after: through the old Topic, the new Topic, or a Placement. Title, body
//   and status never move a date (ADR-0014), so they re-derive nothing.
// - A move to another Topic ends the Readiness of every Class the new Topic does not reach.
//   A Detach deletes nothing, so the Standalone Lesson keeps its inert marks (ADR-0015).
// An unknown id returns undefined, the door's 404.
export function editLesson(
	db: Db,
	{ id, change, today }: { id: string; change: LessonChange; today: string }
): ({ lesson: typeof schema.lesson.$inferSelect } & WriteReport) | undefined {
	const [row] = db.select().from(schema.lesson).where(eq(schema.lesson.id, id)).all();
	if (!row) return undefined;

	const next: Partial<typeof schema.lesson.$inferInsert> = {};
	if (change.title !== undefined) next.title = required(change.title, 'A Lesson needs a title.');
	if (change.body !== undefined) next.body = lessonBody(change.body);
	if (change.length !== undefined) next.length = lessonLength(change.length);
	if (change.status !== undefined) next.status = lessonStatus(change.status);

	const { topicId } = change;
	const moves = topicId !== undefined && topicId !== row.topicId;
	if (moves && topicId !== null) {
		const [topic] = db
			.select({ id: schema.topic.id })
			.from(schema.topic)
			.where(eq(schema.topic.id, topicId))
			.all();
		if (!topic) throw new Refused('missing', 'Topic not found.');
		if (row.topicId === null)
			throw new Refused('conflict', 'A Standalone Lesson cannot rejoin a Topic.');
		next.position = endOfTopic(db, topicId);
	}
	if (moves) next.topicId = topicId;

	const changed = Object.fromEntries(
		Object.entries(next).filter(([key, value]) => row[key as keyof typeof row] !== value)
	) as typeof next;
	if (Object.keys(changed).length === 0) return { lesson: row, atRisk: [], placementsMoved: [] };

	const [lesson] = db
		.update(schema.lesson)
		.set(changed)
		.where(eq(schema.lesson.id, id))
		.returning()
		.all();
	if (!moves && changed.length === undefined) return { lesson, atRisk: [], placementsMoved: [] };

	const assignedTo = (topicId: string | null) =>
		topicId === null
			? []
			: db
					.select({ classId: schema.assignedTopic.classId })
					.from(schema.assignedTopic)
					.where(eq(schema.assignedTopic.topicId, topicId))
					.all()
					.map((r) => r.classId);
	const placedOn = db
		.selectDistinct({ classId: schema.placement.classId })
		.from(schema.placement)
		.where(eq(schema.placement.lessonId, id))
		.all()
		.map((r) => r.classId);
	const reachesNow = [...assignedTo(lesson.topicId), ...placedOn];

	if (moves && lesson.topicId !== null) {
		db.delete(schema.readiness)
			.where(
				and(eq(schema.readiness.lessonId, id), notInArray(schema.readiness.classId, reachesNow))
			)
			.run();
	}

	const classIds = new Set([...assignedTo(row.topicId), ...reachesNow]);
	return { lesson, ...combineReports([...classIds].map((c) => rederive(db, c, today))) };
}

// Removes a Lesson entirely, along with its Links, and re-derives every Class assigned its
// Topic. Refuses when a Class has already been taught this Lesson: the historical Session rows
// reference it (ADR-0002), so deleting it would erase part of the record of what happened —
// the taught-by block in the Lesson editor is what warns Ed before he tries this and it fails.
// The refusal carries the way out in teacher terms — Detach — usable at the form and the API
// alike; the API spec names the PATCH route separately.
// Refuses too while any Placement names the Lesson (ADR-0022): the "no mark" answer to whether a
// Standalone Lesson is schedulable depends entirely on a `placement` row naming it, so deleting
// one out from under a live Placement would leave that row naming a Lesson that no longer exists.
// An unknown id returns undefined, the door's 404; every other refusal throws `Refused`.
export function deleteLesson(
	db: Db,
	{ id, today, dir }: { id: string; today: string; dir: string }
): typeof schema.lesson.$inferSelect | undefined {
	const [row] = db.select().from(schema.lesson).where(eq(schema.lesson.id, id)).all();
	if (!row) return undefined;

	if (classesTaughtLesson(db, { lessonId: id, today }).length > 0) {
		throw new Refused(
			'conflict',
			row.topicId !== null
				? 'A Class has already been taught this Lesson, so it cannot be removed. Detach it from its Topic instead.'
				: 'A Class has already been taught this Lesson, so it cannot be removed.'
		);
	}

	const [placedBy] = db
		.select({ id: schema.placement.id })
		.from(schema.placement)
		.where(eq(schema.placement.lessonId, id))
		.all();
	if (placedBy) {
		throw new Refused(
			'conflict',
			'A Placement names this Lesson, so it cannot be removed. Remove the Placement first.'
		);
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
	deleteAttachmentsOfLesson(db, id, dir);
	db.delete(schema.lesson).where(eq(schema.lesson.id, id)).run();

	if (row.topicId) rederiveTopic(db, row.topicId, today);
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
	label = required(label, 'A Link needs a label.');
	url = linkUrl(url);
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
		.set({ label: required(label, 'A Link needs a label.'), url: linkUrl(url) })
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

// Creates one Topic, with its Lessons and their Links, in a single all-or-nothing transaction —
// optionally creating its Course inline if it does not yet exist. Throwing `Refused` leaves
// `inTransaction` to roll the write back on the way out; every other throw rolls back too and
// propagates, so an unexpected fault reaches the door as the 500 it is, with nothing committed.
//
// Every field runs the same rules as the one-at-a-time writers, inside the transaction, so a
// refused field on the ninth Lesson leaves nothing behind. Exactly one of course id/name is
// `invalid`, a course id the body names that is not there is `missing`, and a Topic name that
// collides is `conflict`.
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
			status?: string;
			links?: Array<{ url: string; label: string }>;
		}>;
	},
	today: string
): {
	course: { id: string; name: string };
	courseCreated: boolean;
	topic: { id: string; name: string; courseId: string };
	lessons: Array<{
		id: string;
		title: string;
		position: number;
		links: Array<{ id: string; url: string; label: string; position: number }>;
	}>;
} {
	if (courseId && courseName) {
		throw new Refused('invalid', 'The "course" field must carry exactly one of "id" or "name".');
	}
	if (!courseId && !courseName) {
		throw new Refused('invalid', 'The "course" field must carry exactly one of "id" or "name".');
	}

	return inTransaction(client, () => {
		let resolvedCourseId = courseId;
		let courseCreated = false;

		if (courseName) {
			const trimmed = required(courseName, 'A Course needs a name.');
			const [existing] = db
				.select({ id: schema.course.id, name: schema.course.name })
				.from(schema.course)
				.where(sql`lower(${schema.course.name}) = lower(${trimmed})`)
				.all();
			if (existing) {
				resolvedCourseId = existing.id;
			} else {
				const [created] = db
					.insert(schema.course)
					.values({ name: trimmed, tone: nextCourseTone(db) })
					.returning()
					.all();
				resolvedCourseId = created.id;
				courseCreated = true;
			}
		}

		if (!resolvedCourseId) throw new Refused('missing', 'Course not found.');

		const courseRecord = db
			.select({ id: schema.course.id, name: schema.course.name })
			.from(schema.course)
			.where(eq(schema.course.id, resolvedCourseId))
			.all()[0];
		if (!courseRecord) throw new Refused('missing', 'Course not found.');

		const trimmedTopicName = required(topicName, 'A Topic needs a name.');
		const topicCollision = findTopicNameCollision(db, {
			courseId: resolvedCourseId,
			name: trimmedTopicName
		});
		if (topicCollision) {
			throw new Refused(
				'conflict',
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
					title: required(lesson.title, 'A Lesson needs a title.'),
					position: i,
					...(lesson.body !== undefined ? { body: lessonBody(lesson.body) } : {}),
					...(lesson.length !== undefined ? { length: lessonLength(lesson.length) } : {}),
					...(lesson.status !== undefined ? { status: lessonStatus(lesson.status) } : {})
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
							url: linkUrl(link.url),
							label: required(link.label, 'A Link needs a label.'),
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
			course: { id: courseRecord.id, name: courseRecord.name },
			courseCreated,
			topic: { id: topicRow.id, name: topicRow.name, courseId: topicRow.courseId },
			lessons: lessonResults
		};
	});
}
