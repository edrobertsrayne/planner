// The Sequence: the shared Lessons one Class teaches, in that Class's own order (ADR-0026). The
// engine lays it onto the Class's Available Slots. Every rule about it lives here (ADR-0025); the
// form actions only call these functions.
//
// Each write runs in one transaction, re-derives this Class only, from today, and answers with
// the `WriteReport` plus `lessonsChanged`: how many Lessons got a different first date.
import { and, asc, eq, lte } from 'drizzle-orm';
import * as schema from '../db/schema';
import { inTransaction } from '../db';
import { rederive, scheduleFor, type Db, type WriteReport } from './derive';
import { nextPosition } from './ordering';
import { Refused } from './refused';

// The Teaching note of one Class and Lesson, or null when there is none (ADR-0026). Both parts of
// a Length-2 Lesson, a Continuation and every Placement of the Lesson on this Class share it.
export function teachingNoteOf(db: Db, classId: string, lessonId: string): string | null {
	const [row] = db
		.select({ body: schema.teachingNote.body })
		.from(schema.teachingNote)
		.where(
			and(eq(schema.teachingNote.classId, classId), eq(schema.teachingNote.lessonId, lessonId))
		)
		.all();
	return row?.body ?? null;
}

// Fixed Lessons: those with a Session for this Class on or before today. They are what was taught,
// so no write may move or remove them. The one answer to "is this Lesson fixed?".
export function fixedLessonIds(db: Db, classId: string, today: string): Set<string> {
	return new Set(
		db
			.select({ lessonId: schema.session.lessonId })
			.from(schema.session)
			.where(and(eq(schema.session.classId, classId), lte(schema.session.date, today)))
			.all()
			.flatMap((row) => (row.lessonId ? [row.lessonId] : []))
	);
}

// The Lessons of a Class's Sequence, in order.
function sequenceLessonIds(db: Db, classId: string): string[] {
	return db
		.select({ lessonId: schema.classLesson.lessonId })
		.from(schema.classLesson)
		.where(eq(schema.classLesson.classId, classId))
		.orderBy(asc(schema.classLesson.position))
		.all()
		.map((row) => row.lessonId);
}

// The Lessons a Placement names on this Class.
function placedLessonIds(db: Db, classId: string): Set<string> {
	return new Set(
		db
			.select({ lessonId: schema.placement.lessonId })
			.from(schema.placement)
			.where(eq(schema.placement.classId, classId))
			.all()
			.map((row) => row.lessonId)
	);
}

// Where each Lesson of the Sequence first falls, from the engine: the date and Period of its first
// part, or null when no Slot is left. Taught Lessons come from the record, the rest from today on.
function firstSlots(db: Db, classId: string, today: string): Map<string, string | null> {
	const result = scheduleFor(db, { classId, boundary: today });
	const first = new Map<string, string>();
	for (const part of [...result.history, ...result.scheduled]) {
		const at = `${part.date}|${part.period}`;
		const seen = first.get(part.lessonId);
		if (seen === undefined || at < seen) first.set(part.lessonId, at);
	}
	return new Map(sequenceLessonIds(db, classId).map((id) => [id, first.get(id) ?? null]));
}

// Runs one Sequence write: in one transaction, re-deriving this Class from today, and counting the
// Lessons that held a place before and now fall on a different first date.
function writeSequence<T>(
	db: Db,
	{ classId, today }: { classId: string; today: string },
	write: () => T
): T & WriteReport & { lessonsChanged: number } {
	return inTransaction(db.$client, () => {
		const before = firstSlots(db, classId, today);
		const result = write();
		const report = rederive(db, classId, today);
		const after = firstSlots(db, classId, today);
		let lessonsChanged = 0;
		for (const [id, at] of before) if (after.get(id) !== at) lessonsChanged++;
		return { ...result, ...report, lessonsChanged };
	});
}

export type SkipReason = 'in-sequence' | 'placed';

// Assign Topic: appends the Topic's Lessons, as they are now and in Topic order, at the end of the
// Sequence. A Lesson already in the Sequence, or named by a Placement on this Class, is skipped
// with its reason. A Topic outside the Class's Course is `invalid`. Assigning a Topic again adds
// the Lessons written since, and the ones the teacher removed.
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
		throw new Refused('invalid', "This Topic does not belong to the Class's Course.");
	}

	return writeSequence(db, { classId, today }, () => {
		const inSequence = new Set(sequenceLessonIds(db, classId));
		const placed = placedLessonIds(db, classId);
		const added: { id: string; title: string }[] = [];
		const skipped: { id: string; title: string; reason: SkipReason }[] = [];

		const lessons = db
			.select({ id: schema.lesson.id, title: schema.lesson.title })
			.from(schema.lesson)
			.where(eq(schema.lesson.topicId, topicId))
			.orderBy(asc(schema.lesson.position))
			.all();
		let position = nextPosition(
			db
				.select({ position: schema.classLesson.position })
				.from(schema.classLesson)
				.where(eq(schema.classLesson.classId, classId))
				.all()
		);
		for (const lesson of lessons) {
			if (inSequence.has(lesson.id)) {
				skipped.push({ ...lesson, reason: 'in-sequence' });
			} else if (placed.has(lesson.id)) {
				skipped.push({ ...lesson, reason: 'placed' });
			} else {
				db.insert(schema.classLesson).values({ classId, lessonId: lesson.id, position }).run();
				position++;
				added.push(lesson);
			}
		}
		return { added, skipped };
	});
}

export interface SequenceEntry {
	lessonId: string;
	title: string;
	topicId: string | null;
	topicName: string | null;
	length: number;
	status: 'draft' | 'planned';
	// The date of the Lesson's first part, or null when no Slot is left this year.
	firstDate: string | null;
	fixed: boolean;
	note: string | null;
	ready: boolean;
}

export interface TopicOption {
	id: string;
	name: string;
	lessonCount: number;
	// Lessons of the Topic already in the Sequence or Placed on this Class.
	counted: number;
}

// The Sequence tab's read: the entries in order, and the Course's Topics with their counts.
export function sequenceView(db: Db, { classId, today }: { classId: string; today: string }) {
	const [cls] = db
		.select({ courseId: schema.classes.courseId })
		.from(schema.classes)
		.where(eq(schema.classes.id, classId))
		.all();
	if (!cls) return null;

	const fixed = fixedLessonIds(db, classId, today);
	const slots = firstSlots(db, classId, today);
	const ready = new Set(
		db
			.select({ lessonId: schema.readiness.lessonId })
			.from(schema.readiness)
			.where(eq(schema.readiness.classId, classId))
			.all()
			.map((row) => row.lessonId)
	);
	const notes = new Map(
		db
			.select({ lessonId: schema.teachingNote.lessonId, body: schema.teachingNote.body })
			.from(schema.teachingNote)
			.where(eq(schema.teachingNote.classId, classId))
			.all()
			.map((row) => [row.lessonId, row.body])
	);

	const entries: SequenceEntry[] = db
		.select({
			lessonId: schema.lesson.id,
			title: schema.lesson.title,
			topicId: schema.topic.id,
			topicName: schema.topic.name,
			length: schema.lesson.length,
			status: schema.lesson.status
		})
		.from(schema.classLesson)
		.innerJoin(schema.lesson, eq(schema.lesson.id, schema.classLesson.lessonId))
		.leftJoin(schema.topic, eq(schema.topic.id, schema.lesson.topicId))
		.where(eq(schema.classLesson.classId, classId))
		.orderBy(asc(schema.classLesson.position))
		.all()
		.map((row) => ({
			...row,
			firstDate: slots.get(row.lessonId)?.split('|')[0] ?? null,
			fixed: fixed.has(row.lessonId),
			note: notes.get(row.lessonId) ?? null,
			ready: ready.has(row.lessonId)
		}));

	const held = new Set([...entries.map((e) => e.lessonId), ...placedLessonIds(db, classId)]);
	const topicLessons = db
		.select({ id: schema.lesson.id, topicId: schema.lesson.topicId })
		.from(schema.lesson)
		.innerJoin(schema.topic, eq(schema.topic.id, schema.lesson.topicId))
		.where(eq(schema.topic.courseId, cls.courseId))
		.all();
	const topics: TopicOption[] = db
		.select({ id: schema.topic.id, name: schema.topic.name })
		.from(schema.topic)
		.where(eq(schema.topic.courseId, cls.courseId))
		.orderBy(asc(schema.topic.name))
		.all()
		.map((topic) => {
			const lessons = topicLessons.filter((lesson) => lesson.topicId === topic.id);
			return {
				...topic,
				lessonCount: lessons.length,
				counted: lessons.filter((lesson) => held.has(lesson.id)).length
			};
		});

	return { entries, topics };
}
