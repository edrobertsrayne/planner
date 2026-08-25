// A Class: its identity, the Topics assigned to it, and how far through them it has got. The
// Class is what the engine schedules, so assigning or reordering its Topics re-derives it.
import { and, asc, eq, lt } from 'drizzle-orm';
import { nextTone } from '$lib/class-tone';
import * as schema from '../db/schema';
import { lessonNames, rederive, scheduleFor, type Db, type WriteReport } from './derive';
import { runway as deriveRunway, type Runway } from './engine';
import { nextPosition, swapTargets, type Direction } from './ordering';

// The Tone is assigned once here, at creation — the next unused position of the fixed walk
// (ADR-0013) — and never touched again by any other write.
export function createClass(db: Db, { label, courseId }: { label: string; courseId: string }) {
	const tonesInUse = db
		.select({ tone: schema.classes.tone })
		.from(schema.classes)
		.all()
		.map((row) => row.tone);
	const [row] = db
		.insert(schema.classes)
		.values({ label, courseId, tone: nextTone(tonesInUse) })
		.returning()
		.all();
	return row;
}

// Every Class, alphabetical — what classLanes and the Class page's create form read.
export function listClasses(db: Db) {
	return db
		.select({
			id: schema.classes.id,
			label: schema.classes.label,
			courseId: schema.classes.courseId,
			tone: schema.classes.tone
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

	const position = nextPosition(
		db
			.select({ position: schema.assignedTopic.position })
			.from(schema.assignedTopic)
			.where(eq(schema.assignedTopic.classId, classId))
			.all()
	);

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
	return rederive(db, classId, today);
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
	}: { classId: string; id: string; direction: Direction; today: string }
): WriteReport {
	const swap = swapTargets(assignedTopicsOf(db, classId), id, direction);
	if (!swap) return { atRisk: [] };

	const [a, b] = swap;
	db.update(schema.assignedTopic)
		.set({ position: b.position })
		.where(eq(schema.assignedTopic.id, a.id))
		.run();
	db.update(schema.assignedTopic)
		.set({ position: a.position })
		.where(eq(schema.assignedTopic.id, b.id))
		.run();

	return rederive(db, classId, today);
}

// Read back exactly where a Class has got to. Pure: never writes.
export function classSchedule(db: Db, { classId, today }: { classId: string; today: string }) {
	const result = scheduleFor(db, { classId, boundary: today });
	return { ...result, runway: deriveRunway(result) };
}

export interface ClassLane {
	classId: string;
	classLabel: string;
	courseId: string;
	tone: number;
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

// The note Ed wrote against one taught occasion — read per lane rather than in the batch above,
// since a lane has at most one.
function noteAt(db: Db, classId: string, date: string, period: number): string | null {
	const [row] = db
		.select({ note: schema.session.note })
		.from(schema.session)
		.where(
			and(
				eq(schema.session.classId, classId),
				eq(schema.session.date, date),
				eq(schema.session.period, period)
			)
		)
		.all();
	return row?.note ?? null;
}

// One lane per Class (issue #37): how far it has got through its Assigned Topics — never its
// Course (ADR-0010) — what was last taught and its Session note, what is queued next, and the
// Runway. Reuses classSchedule's single derived answer per Class; there is no separate
// Classes-view computation. `classId` restricts to one Class, for the lane atop its own Class page.
export function classLanes(
	db: Db,
	{ today, classId }: { today: string; classId?: string }
): ClassLane[] {
	const classes = listClasses(db).filter((c) => !classId || c.id === classId);

	const lanes = classes.map((cls) => {
		const result = classSchedule(db, { classId: cls.id, today });
		return {
			cls,
			result,
			lastEntry: result.history[result.history.length - 1] ?? null,
			nextEntry: result.scheduled[0] ?? null
		};
	});

	const names = lessonNames(db, [
		...new Set(
			lanes.flatMap((lane) =>
				[lane.lastEntry?.lessonId, lane.nextEntry?.lessonId].filter((id) => id !== undefined)
			)
		)
	]);

	return lanes.map(({ cls, result, lastEntry, nextEntry }) => {
		const lastName = lastEntry ? names.get(lastEntry.lessonId) : undefined;

		return {
			classId: cls.id,
			classLabel: cls.label,
			courseId: cls.courseId,
			tone: cls.tone,
			taught: result.history.length,
			total: result.history.length + result.scheduled.length + result.unplaced.length,
			lastTaught:
				lastEntry && lastName
					? {
							date: lastEntry.date,
							period: lastEntry.period,
							...lastName,
							note: noteAt(db, cls.id, lastEntry.date, lastEntry.period)
						}
					: null,
			nextUp: (nextEntry && names.get(nextEntry.lessonId)) ?? null,
			unplacedCount: result.unplaced.length,
			runway: result.runway
		};
	});
}
