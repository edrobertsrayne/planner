import { and, eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, refused, setSequence, setUp } from './fixtures';
import {
	assignTopic,
	classSchedule,
	fixedLessonIds,
	recordContinuation,
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
