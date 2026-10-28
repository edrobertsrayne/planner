// Courses and Topics — the planning containers. Neither is a scheduling input, so creating,
// renaming, moving or deleting one never re-derives; nor does the order of a Topic's Lessons,
// because each Class holds its own Sequence (ADR-0026). A Course's Tone is assigned once, at
// creation (ADR-0013). A delete that a Sequence or a Class makes risky asks first.
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { nextTone } from '$lib/class-tone';
import { courseDeleteText, standaloneText } from '$lib/delete-text';
import * as schema from '../db/schema';
import { inTransaction } from '../db';
import { Refused } from './refused';
import { lessonsOf } from './lessons';
import { required, requireRow, sameName } from './fields';
import type { Db } from './derive';

// Course and Topic names carry an explicit uniqueness rule (issue #131, §6 of the planning API
// spec). The database indexes are the guard of last resort — so the seam refuses the write first
// and never lets a raw SQLITE_CONSTRAINT reach the user. A collision is a `conflict`: the request
// was well-formed and answered with its real outcome.

// A Course is refused on create or rename if any other Course already holds the name. The
// comparison is case-insensitive over names the caller has already trimmed. The seam throws with
// the message already written for the teacher to read; the form action maps it to a 4xx with no
// further work.
function assertCourseNameAvailable(
	db: Db,
	{ name, exceptId }: { name: string; exceptId?: string }
) {
	const [collision] = db
		.select({ name: schema.course.name })
		.from(schema.course)
		.where(
			and(sameName(schema.course.name, name), exceptId ? ne(schema.course.id, exceptId) : undefined)
		)
		.all();
	if (collision) {
		throw new Refused('conflict', `A Course called "${collision.name}" already exists.`);
	}
}

// A Topic is refused on create, rename or move if its Course already holds a Topic of that name.
// Two Courses may each hold a "Forces", so the check is scoped to the Course, and the comparison is
// case-insensitive over names the caller has already trimmed.
function assertTopicNameAvailable(
	db: Db,
	{
		courseId,
		courseName,
		name,
		exceptId
	}: { courseId: string; courseName: string; name: string; exceptId?: string }
) {
	const [collision] = db
		.select({ name: schema.topic.name })
		.from(schema.topic)
		.where(
			and(
				eq(schema.topic.courseId, courseId),
				sameName(schema.topic.name, name),
				exceptId ? ne(schema.topic.id, exceptId) : undefined
			)
		)
		.all();
	if (collision) {
		throw new Refused(
			'conflict',
			`The Course "${courseName}" already holds a Topic called "${collision.name}".`
		);
	}
}

export function listCourses(db: Db) {
	return db.select().from(schema.course).orderBy(asc(schema.course.name)).all();
}

// The one-record reads the API's `GET /:id` routes need, so no route runs a query of its own. An
// id the URL names but the database does not hold returns undefined, the door's 404.
export function courseById(db: Db, id: string) {
	const [row] = db.select().from(schema.course).where(eq(schema.course.id, id)).all();
	return row;
}

export function topicById(db: Db, id: string) {
	const [row] = db.select().from(schema.topic).where(eq(schema.topic.id, id)).all();
	return row;
}

// No particular order (ADR-0026): a Course is an unordered container of Topics.
export function topicsOf(db: Db, courseId: string) {
	return db.select().from(schema.topic).where(eq(schema.topic.courseId, courseId)).all();
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

// A Course with no Topics goes at once. A Course that still holds Topics asks first: its Topics go,
// and its Lessons become Standalone Lessons that every Sequence keeps (ADR-0026). The form's
// dialog names the totals; the API has no confirm, so it answers 409 with the reason. A Class following the Course refuses unconditionally: confirming never overrides it.
//
// The question is an `unconfirmed` refusal — the same throw a refusal always is, carrying the
// reason to show — and the caller asks again with `confirmed=true`. An unknown id returns
// undefined, the door's 404.
export function deleteCourse(
	db: Db,
	id: string,
	{ confirmed = false }: { confirmed?: boolean } = {}
): typeof schema.course.$inferSelect | undefined {
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

	const topicIds = topicsOf(db, id).map((topic) => topic.id);
	if (topicIds.length > 0 && !confirmed) {
		const [{ lessonTotal }] = db
			.select({ lessonTotal: sql<number>`count(*)` })
			.from(schema.lesson)
			.where(inArray(schema.lesson.topicId, topicIds))
			.all();
		throw new Refused(
			'unconfirmed',
			`Delete ${course.name}? ${courseDeleteText(topicIds.length, lessonTotal)}`
		);
	}

	// The Lessons detach, the Topics go and the Course goes in one all-or-nothing write.
	return inTransaction(db.$client, () => {
		if (topicIds.length > 0) {
			db.update(schema.lesson)
				.set({ topicId: null })
				.where(inArray(schema.lesson.topicId, topicIds))
				.run();
			db.delete(schema.topic).where(inArray(schema.topic.id, topicIds)).run();
		}

		const [deleted] = db.delete(schema.course).where(eq(schema.course.id, id)).returning().all();
		return deleted;
	});
}

export function createTopic(db: Db, { courseId, name }: { courseId: string; name: string }) {
	const course = requireRow(db, schema.course, courseId, 'Course not found.');
	const trimmed = required(name, 'A Topic needs a name.');
	assertTopicNameAvailable(db, { courseId, courseName: course.name, name: trimmed });
	const [row] = db.insert(schema.topic).values({ courseId, name: trimmed }).returning().all();
	return row;
}

export function renameTopic(db: Db, { id, name }: { id: string; name: string }) {
	// The Course is guaranteed by the foreign key, so it is joined rather than guarded.
	const [existing] = db
		.select({ courseId: schema.topic.courseId, courseName: schema.course.name })
		.from(schema.topic)
		.innerJoin(schema.course, eq(schema.course.id, schema.topic.courseId))
		.where(eq(schema.topic.id, id))
		.all();
	if (!existing) return undefined;
	const trimmed = required(name, 'A Topic needs a name.');
	assertTopicNameAvailable(db, {
		courseId: existing.courseId,
		courseName: existing.courseName,
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

// Files a Topic in another Course. Its Lessons, their Topic order, Sequences, Readiness and
// Placements stay as they are, so nothing is re-derived (ADR-0026). An unknown Topic returns
// undefined, the door's 404.
export function moveTopicToCourse(db: Db, { id, courseId }: { id: string; courseId: string }) {
	const [existing] = db.select().from(schema.topic).where(eq(schema.topic.id, id)).all();
	if (!existing) return undefined;
	const target = requireRow(db, schema.course, courseId, 'Course not found.');
	assertTopicNameAvailable(db, {
		courseId,
		name: existing.name,
		exceptId: id,
		courseName: target.name
	});
	const [row] = db
		.update(schema.topic)
		.set({ courseId })
		.where(eq(schema.topic.id, id))
		.returning()
		.all();
	return row;
}

// A Topic with no Lessons goes at once. A Topic that still holds Lessons asks first: its Lessons
// become Standalone Lessons, and every Sequence keeps them (ADR-0026). Nothing is re-derived.
//
// The question is an `unconfirmed` refusal, answered with `confirmed=true`. An unknown id returns
// undefined, the door's 404.
export function deleteTopic(
	db: Db,
	id: string,
	{ confirmed = false }: { confirmed?: boolean } = {}
): typeof schema.topic.$inferSelect | undefined {
	const [topic] = db.select().from(schema.topic).where(eq(schema.topic.id, id)).all();
	if (!topic) return undefined;

	const lessons = lessonsOf(db, id);
	if (lessons.length > 0 && !confirmed) {
		throw new Refused('unconfirmed', `Delete ${topic.name}? ${standaloneText(lessons.length)}`);
	}

	// The Lessons detach and the Topic goes in one all-or-nothing write: a Topic half removed
	// would leave Lessons still filed against a Topic that is no longer there.
	return inTransaction(db.$client, () => {
		if (lessons.length > 0) {
			db.update(schema.lesson).set({ topicId: null }).where(eq(schema.lesson.topicId, id)).run();
		}

		const [deleted] = db.delete(schema.topic).where(eq(schema.topic.id, id)).returning().all();
		return deleted;
	});
}
