import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, refused, setUp } from './fixtures';
import { addLesson, assignTopic, sequenceLessonIds } from './index';
import type { Db } from './derive';
import * as schema from '../db/schema';
import { today, taughtOrder } from './sequence-fixtures';

describe('Add Lesson', () => {
	function lessonRow(db: Db, id: string) {
		return db.select().from(schema.lesson).where(eq(schema.lesson.id, id)).all()[0];
	}

	test('puts a new Standalone Lesson of Length 1, Draft, after the given Lesson', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [one, two, three] = makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		const { lesson } = addLesson(db, {
			classId: classA.id,
			title: ' Quiz ',
			afterLessonId: one.id,
			today
		});

		expect(lessonRow(db, lesson.id)).toMatchObject({
			title: 'Quiz',
			topicId: null,
			length: 1,
			status: 'draft'
		});
		expect(sequenceLessonIds(db, classA.id)).toEqual([one.id, lesson.id, two.id, three.id]);
		expect(taughtOrder(db, classA.id)).toEqual([one.id, lesson.id, two.id, three.id]);
	});

	test('puts it at the first untaught place when no Lesson is given', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [one, two, three] = makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		// On Thu 3 Sep Lessons 1 and 2 are taught, so they are fixed.
		const { lesson } = addLesson(db, { classId: classA.id, title: 'Quiz', today: '2026-09-03' });

		expect(sequenceLessonIds(db, classA.id)).toEqual([one.id, two.id, lesson.id, three.id]);
	});

	test('puts it first when nothing is taught, and in an empty Sequence', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [one] = makeLessons(db, topic.id, 1);

		const first = addLesson(db, { classId: classA.id, title: 'First', today }).lesson;
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });
		const second = addLesson(db, { classId: classA.id, title: 'Second', today }).lesson;

		expect(sequenceLessonIds(db, classA.id)).toEqual([second.id, first.id, one.id]);
	});

	test('may go straight after the last fixed Lesson, and refuses a place in front of one', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [one, two, three] = makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });
		const on = '2026-09-03';

		refused(
			() => addLesson(db, { classId: classA.id, title: 'Quiz', afterLessonId: one.id, today: on }),
			'conflict',
			`A Lesson cannot go in front of “${two.title}”, which was taught.`
		);
		expect(sequenceLessonIds(db, classA.id)).toEqual([one.id, two.id, three.id]);

		const { lesson } = addLesson(db, {
			classId: classA.id,
			title: 'Quiz',
			afterLessonId: two.id,
			today: on
		});
		expect(sequenceLessonIds(db, classA.id)).toEqual([one.id, two.id, lesson.id, three.id]);
	});

	test('refuses an empty title and a Lesson that is not in the Sequence', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [one] = makeLessons(db, topic.id, 1);

		refused(
			() => addLesson(db, { classId: classA.id, title: '  ', today }),
			'invalid',
			'A Lesson needs a title.'
		);
		refused(
			() => addLesson(db, { classId: classA.id, title: 'Quiz', afterLessonId: one.id, today }),
			'invalid',
			'That Lesson is not in this Sequence.'
		);
	});

	test('is in no other Class, and changes no other Class', () => {
		const { db, course, classA, classB } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 2);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });
		assignTopic(db, { classId: classB.id, topicId: topic.id, today });
		const before = taughtOrder(db, classB.id);

		const { lesson } = addLesson(db, { classId: classA.id, title: 'Quiz', today });

		expect(sequenceLessonIds(db, classB.id)).toEqual(lessons.map((l) => l.id));
		expect(taughtOrder(db, classB.id)).toEqual(before);
		expect(sequenceLessonIds(db, classA.id)).toContain(lesson.id);
	});

	test('says how many Lessons change date', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		const report = addLesson(db, { classId: classA.id, title: 'Quiz', today });

		// The Quiz takes the first Slot. Lesson 1 only moves from P5 to P6 on 3 Sep, the same date.
		expect(report.changed.length).toBe(2);
	});
});
