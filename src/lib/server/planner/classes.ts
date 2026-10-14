// A Class: its identity, and how far through its Sequence it has got. The Sequence itself is in
// sequence.ts.
import { asc, eq } from 'drizzle-orm';
import { nextTone } from '$lib/class-tone';
import * as schema from '../db/schema';
import { lessonNames, scheduleFor, type Db } from './derive';
import { runway as deriveRunway, type Runway } from './engine';
import { required } from './fields';
import { teachingNoteOf } from './sequence';

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
		.values({
			label: required(label, 'A Class needs a label.'),
			courseId,
			tone: nextTone(tonesInUse)
		})
		.returning()
		.all();
	return row;
}

// Changes a Class's label only — its Course and Tone are fixed at creation and untouched here.
export function renameClass(db: Db, { id, label }: { id: string; label: string }) {
	const trimmed = required(label, 'A Class needs a label.');
	const [row] = db
		.update(schema.classes)
		.set({ label: trimmed })
		.where(eq(schema.classes.id, id))
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
			tone: schema.classes.tone,
			courseId: schema.classes.courseId,
			courseName: schema.course.name
		})
		.from(schema.classes)
		.innerJoin(schema.course, eq(schema.course.id, schema.classes.courseId))
		.where(eq(schema.classes.id, id))
		.all();
	return row ?? null;
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
		topicName: string | null;
		note: string | null;
	} | null;
	nextUp: { title: string; topicName: string | null } | null;
	unplacedCount: number;
	runway: Runway;
}

// One lane per Class (issue #37): how far it has got through its Sequence — never its
// Course (ADR-0010) — what was last taught and its Teaching note, what is queued next, and the
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
							note: teachingNoteOf(db, cls.id, lastEntry.lessonId)
						}
					: null,
			nextUp: (nextEntry && names.get(nextEntry.lessonId)) ?? null,
			unplacedCount: result.unplaced.length,
			runway: result.runway
		};
	});
}
