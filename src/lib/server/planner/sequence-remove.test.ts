import { and, eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, refused, setUp } from './fixtures';
import { assignTopic, classSchedule, removeFromSequence } from './index';
import type { Db } from './derive';
import * as schema from '../db/schema';
import { today, taughtOrder, sessionRows } from './sequence-fixtures';

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

	test('refuses an empty list of Lessons', () => {
		const { db, classA } = setUp();

		refused(
			() => removeFromSequence(db, { classId: classA.id, lessonIds: [], today }),
			'invalid',
			'Pick a Lesson to remove.'
		);
	});

	test('moves the later Lessons up into the free Slots', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [one, two, three] = makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		const report = removeFromSequence(db, { classId: classA.id, lessonIds: [one.id], today });

		expect(taughtOrder(db, classA.id)).toEqual([two.id, three.id]);
		// Lesson 3 falls on an earlier date. Lesson 2 only moves from P6 to P5 on 3 Sep, which is the
		// same date, and Lesson 1 left, so neither counts.
		expect(report.changed.length).toBe(1);
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
