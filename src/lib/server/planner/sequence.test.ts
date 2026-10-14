import { and, eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, refused, setSequence, setUp } from './fixtures';
import {
	assignTopic,
	classSchedule,
	fixedLessonIds,
	sequenceLessonIds,
	recordContinuation,
	removeFromSequence,
	sessionDetail
} from './index';
import type { Db } from './derive';
import * as schema from '../db/schema';

const today = '2026-09-01';

// The Lessons a Class teaches, in the order they fall on its calendar.
function taughtOrder(db: Db, classId: string, on = today) {
	const { history, scheduled } = classSchedule(db, { classId, today: on });
	return [...history, ...scheduled].map((s) => s.lessonId);
}

function sessionRows(db: Db, classId: string) {
	return db
		.select()
		.from(schema.session)
		.all()
		.filter((s) => s.classId === classId)
		.map(({ date, period, lessonId }) => ({ date, period, lessonId }));
}

describe('Assign Topic', () => {
	test("appends the Topic's Lessons in Topic Lesson order", () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 3);

		const report = assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		expect(report.added.map((l) => l.id)).toEqual(lessons.map((l) => l.id));
		expect(report.skipped).toEqual([]);
		expect(report.placementsMoved).toEqual([]);
		expect(taughtOrder(db, classA.id)).toEqual(lessons.map((l) => l.id));
	});

	test("puts a second Topic's Lessons after the first Topic's Lessons", () => {
		const { db, course, classA } = setUp();
		const forces = makeTopic(db, course.id, 'Forces');
		const forcesLessons = makeLessons(db, forces.id, 2);
		const waves = makeTopic(db, course.id, 'Waves');
		const wavesLessons = makeLessons(db, waves.id, 2);

		assignTopic(db, { classId: classA.id, topicId: forces.id, today });
		assignTopic(db, { classId: classA.id, topicId: waves.id, today });

		expect(taughtOrder(db, classA.id)).toEqual(
			[...forcesLessons, ...wavesLessons].map((l) => l.id)
		);
	});

	test('skips a Lesson already in the Sequence', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 2);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		const report = assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		expect(report.added).toEqual([]);
		expect(report.skipped).toEqual(
			lessons.map((l) => ({ id: l.id, title: l.title, reason: 'in-sequence' }))
		);
		expect(taughtOrder(db, classA.id)).toEqual(lessons.map((l) => l.id));
	});

	test('skips a Lesson that a Placement names on this Class', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 3);
		const [anchor] = classSchedule(db, { classId: classA.id, today }).openSlots;
		db.insert(schema.placement)
			.values({
				classId: classA.id,
				date: anchor.date,
				slotId: anchor.slotId,
				lessonId: lessons[1].id
			})
			.run();

		const report = assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		expect(report.added.map((l) => l.id)).toEqual([lessons[0].id, lessons[2].id]);
		expect(report.skipped).toEqual([
			{ id: lessons[1].id, title: lessons[1].title, reason: 'placed' }
		]);
		expect(
			db
				.select()
				.from(schema.classLesson)
				.where(
					and(
						eq(schema.classLesson.classId, classA.id),
						eq(schema.classLesson.lessonId, lessons[1].id)
					)
				)
				.all()
		).toEqual([]);
	});

	test("refuses a Topic outside the Class's Course", () => {
		const { db, classA } = setUp();
		const [otherCourse] = db
			.insert(schema.course)
			.values({ name: 'Year 10 Maths' })
			.returning()
			.all();
		const topic = makeTopic(db, otherCourse.id, 'Algebra');
		makeLessons(db, topic.id, 1);

		refused(
			() => assignTopic(db, { classId: classA.id, topicId: topic.id, today }),
			'invalid',
			"This Topic does not belong to the Class's Course."
		);
		expect(db.select().from(schema.classLesson).all()).toEqual([]);
	});

	test('assigned again, adds only a Lesson written since', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 2);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		// A Lesson added to the Topic reaches no Class until the teacher assigns the Topic again.
		const [added] = db
			.insert(schema.lesson)
			.values({ topicId: topic.id, title: 'Lesson 3', position: 2 })
			.returning()
			.all();
		expect(taughtOrder(db, classA.id)).toEqual(lessons.map((l) => l.id));

		const report = assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		expect(report.added.map((l) => l.id)).toEqual([added.id]);
		expect(report.skipped.map((l) => l.id)).toEqual(lessons.map((l) => l.id));
		expect(taughtOrder(db, classA.id)).toEqual([...lessons.map((l) => l.id), added.id]);
	});

	test('assigned again, brings back a Lesson removed from the Sequence', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		db.delete(schema.classLesson)
			.where(
				and(
					eq(schema.classLesson.classId, classA.id),
					eq(schema.classLesson.lessonId, lessons[0].id)
				)
			)
			.run();

		const report = assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		expect(report.added.map((l) => l.id)).toEqual([lessons[0].id]);
		// The removed Lesson comes back at the end of the Sequence.
		expect(taughtOrder(db, classA.id)).toEqual([lessons[1].id, lessons[2].id, lessons[0].id]);
	});

	test('re-derives this Class only', () => {
		const { db, course, classA, classB } = setUp();
		const forces = makeTopic(db, course.id, 'Forces');
		makeLessons(db, forces.id, 4);
		assignTopic(db, { classId: classB.id, topicId: forces.id, today });
		const waves = makeTopic(db, course.id, 'Waves');
		makeLessons(db, waves.id, 2);
		const rowsBefore = sessionRows(db, classB.id);
		const scheduleBefore = classSchedule(db, { classId: classB.id, today });

		assignTopic(db, { classId: classA.id, topicId: waves.id, today });

		expect(sessionRows(db, classB.id)).toEqual(rowsBefore);
		expect(classSchedule(db, { classId: classB.id, today })).toEqual(scheduleBefore);
		expect(taughtOrder(db, classA.id)).toHaveLength(2);
	});

	test('reports how many Lessons got a different first date', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 2);

		const first = assignTopic(db, { classId: classA.id, topicId: topic.id, today });
		const again = assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		// Lessons that held no place before do not count; nothing moved the second time.
		expect(first.lessonsChanged).toBe(0);
		expect(again.lessonsChanged).toBe(0);
	});
});

describe('fixed Lessons', () => {
	test('counts a Lesson with a Session on or before today, and not a later one', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		// Lessons 1 and 2 fall on Thu 3 Sep P5 and P6; Lesson 3 falls on Tue 8 Sep.
		expect(fixedLessonIds(db, classA.id, '2026-09-02')).toEqual(new Set());
		expect(fixedLessonIds(db, classA.id, '2026-09-03')).toEqual(
			new Set([lessons[0].id, lessons[1].id])
		);
		expect(fixedLessonIds(db, classA.id, '2026-09-08')).toEqual(new Set(lessons.map((l) => l.id)));
	});

	test('answers for the one Class asked', () => {
		const { db, course, classA, classB } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 2);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		expect(fixedLessonIds(db, classB.id, '2026-09-30')).toEqual(new Set());
	});
});

describe('re-deriving a Sequence', () => {
	test('a reorder lays the Lessons in the new order', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [one, two, three] = makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		setSequence(db, classA.id, [three.id, one.id, two.id], today);

		expect(taughtOrder(db, classA.id)).toEqual([three.id, one.id, two.id]);
	});

	test('deletes a Session row whose occasion is no longer scheduled', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [one] = makeLessons(db, topic.id, 2);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });
		expect(sessionRows(db, classA.id)).toHaveLength(2);

		// Lesson 2 leaves the Sequence, so 3 Sep P6 becomes an Open Slot.
		setSequence(db, classA.id, [one.id], today);

		expect(sessionRows(db, classA.id)).toEqual([
			{ date: '2026-09-03', period: 5, lessonId: one.id }
		]);
		expect(
			sessionDetail(db, { classId: classA.id, date: '2026-09-03', period: 6, today })?.lesson
		).toBeNull();
	});

	test('deletes a Continuation with the Session row it belonged to', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });
		recordContinuation(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			today: '2026-09-10'
		});
		expect(db.select().from(schema.continuation).all()).toHaveLength(1);

		// The Rewind boundary is before both occasions, so both rows are laid again.
		setSequence(db, classA.id, [], today);

		expect(sessionRows(db, classA.id)).toEqual([]);
		expect(db.select().from(schema.continuation).all()).toEqual([]);
	});
});

describe('Remove', () => {
	function held(db: Db, classId: string, lessonId: string) {
		const where = (table: typeof schema.classLesson | typeof schema.readiness) =>
			and(eq(table.classId, classId), eq(table.lessonId, lessonId));
		return {
			entry: db.select().from(schema.classLesson).where(where(schema.classLesson)).all().length,
			ready: db.select().from(schema.readiness).where(where(schema.readiness)).all().length,
			note: db
				.select()
				.from(schema.teachingNote)
				.where(
					and(eq(schema.teachingNote.classId, classId), eq(schema.teachingNote.lessonId, lessonId))
				)
				.all().length
		};
	}

	function sequenceOf(db: Db, classId: string) {
		return db
			.select()
			.from(schema.classLesson)
			.where(eq(schema.classLesson.classId, classId))
			.orderBy(schema.classLesson.position)
			.all()
			.map((row) => row.lessonId);
	}

	test('deletes the entries, the Readiness and the Teaching note, and keeps the Lesson', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [one, two, three] = makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });
		for (const lesson of [one, two]) {
			db.insert(schema.readiness).values({ classId: classA.id, lessonId: lesson.id }).run();
			db.insert(schema.teachingNote)
				.values({ classId: classA.id, lessonId: lesson.id, body: 'note' })
				.run();
		}

		removeFromSequence(db, { classId: classA.id, lessonIds: [one.id, two.id], today });

		expect(held(db, classA.id, one.id)).toEqual({ entry: 0, ready: 0, note: 0 });
		expect(held(db, classA.id, two.id)).toEqual({ entry: 0, ready: 0, note: 0 });
		expect(held(db, classA.id, three.id).entry).toBe(1);
		expect(db.select().from(schema.lesson).all()).toHaveLength(3);
	});

	test('moves the later Lessons up into the free Slots', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [one, two, three] = makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		const report = removeFromSequence(db, { classId: classA.id, lessonIds: [one.id], today });

		expect(taughtOrder(db, classA.id)).toEqual([two.id, three.id]);
		// Lesson 2 and Lesson 3 each fall on an earlier date. Lesson 1 left, so it does not count.
		expect(report.lessonsChanged).toBe(2);
		expect(report.placementsMoved).toEqual([]);
	});

	test('keeps a Standalone Lesson that is in no other Class', () => {
		const { db, classA } = setUp();
		const [lesson] = db
			.insert(schema.lesson)
			.values({ topicId: null, title: 'One-off', position: 0 })
			.returning()
			.all();
		db.insert(schema.classLesson)
			.values({ classId: classA.id, lessonId: lesson.id, position: 0 })
			.run();

		removeFromSequence(db, { classId: classA.id, lessonIds: [lesson.id], today });

		expect(db.select().from(schema.lesson).all()).toHaveLength(1);
		expect(sequenceOf(db, classA.id)).toEqual([]);
	});

	test('refuses when a Lesson has a Session today, and changes nothing', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [one, two, three] = makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });
		db.insert(schema.teachingNote)
			.values({ classId: classA.id, lessonId: three.id, body: 'note' })
			.run();

		// Lesson 1 falls on Thu 3 Sep P5: a Session today counts as fixed.
		refused(
			() =>
				removeFromSequence(db, {
					classId: classA.id,
					lessonIds: [three.id, one.id],
					today: '2026-09-03'
				}),
			'conflict',
			'“Lesson 1” was taught, so it cannot be removed.'
		);
		expect(sequenceOf(db, classA.id)).toEqual([one.id, two.id, three.id]);
		expect(held(db, classA.id, three.id).note).toBe(1);
	});

	test('changes no other Class', () => {
		const { db, course, classA, classB } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [one, two] = makeLessons(db, topic.id, 2);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });
		assignTopic(db, { classId: classB.id, topicId: topic.id, today });
		db.insert(schema.readiness).values({ classId: classB.id, lessonId: one.id }).run();
		db.insert(schema.teachingNote)
			.values({ classId: classB.id, lessonId: one.id, body: 'note' })
			.run();
		const rowsBefore = sessionRows(db, classB.id);
		const scheduleBefore = classSchedule(db, { classId: classB.id, today });

		removeFromSequence(db, { classId: classA.id, lessonIds: [one.id], today });

		expect(sequenceOf(db, classB.id)).toEqual([one.id, two.id]);
		expect(held(db, classB.id, one.id)).toEqual({ entry: 1, ready: 1, note: 1 });
		expect(sessionRows(db, classB.id)).toEqual(rowsBefore);
		expect(classSchedule(db, { classId: classB.id, today })).toEqual(scheduleBefore);
	});

	test('Assign Topic brings the Lesson back', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [one, two] = makeLessons(db, topic.id, 2);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });
		removeFromSequence(db, { classId: classA.id, lessonIds: [one.id], today });

		const report = assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		expect(report.added.map((l) => l.id)).toEqual([one.id]);
		expect(sequenceOf(db, classA.id)).toEqual([two.id, one.id]);
	});
});

describe('the Sequence order', () => {
	test("lists the Class's Lessons in its own order, a Standalone Lesson included", () => {
		const { db, course, classA, classB } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 3);
		db.update(schema.lesson)
			.set({ topicId: null })
			.where(eq(schema.lesson.id, lessons[1].id))
			.run();
		setSequence(db, classA.id, [lessons[2].id, lessons[1].id, lessons[0].id]);

		expect(sequenceLessonIds(db, classA.id)).toEqual([lessons[2].id, lessons[1].id, lessons[0].id]);
		expect(sequenceLessonIds(db, classB.id)).toEqual([]);
	});
});
