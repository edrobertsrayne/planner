import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, setUp } from './fixtures';
import {
	addLesson,
	assignTopic,
	classSchedule,
	moveLessons,
	sequenceLessonIds,
	sequenceView
} from './index';
import { rederive } from './derive';
import type { Db } from './derive';
import * as schema from '../db/schema';
import { today } from './sequence-fixtures';

describe('the Sequence order', () => {
	test("lists the Class's Lessons in its own order, a Standalone Lesson included", () => {
		const { db, course, classA, classB } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });
		db.update(schema.lesson)
			.set({ topicId: null })
			.where(eq(schema.lesson.id, lessons[1].id))
			.run();
		moveLessons(db, {
			classId: classA.id,
			lessonIds: [lessons[2].id],
			targetId: lessons[0].id,
			today
		});
		moveLessons(db, {
			classId: classA.id,
			lessonIds: [lessons[0].id],
			targetId: lessons[1].id,
			today
		});

		expect(sequenceLessonIds(db, classA.id)).toEqual([lessons[2].id, lessons[1].id, lessons[0].id]);
		expect(sequenceLessonIds(db, classB.id)).toEqual([]);
	});
});

describe('the By week view', () => {
	// Class A's Slots: Week A Mon P3, Wed P1, Thu P5 + P6; Week B Tue P2, Fri P4. Term opens Thu 3 Sep.
	function weeksOf(db: Db, classId: string, on = today) {
		return sequenceView(db, { classId, today: on })!;
	}

	test('runs from the first untaught Lesson to the last, plus one week of free Slots', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 4);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		const view = weeksOf(db, classA.id);
		const rows = view.weeks.flatMap((w) => (w.kind === 'week' ? [w] : []));

		// Week of 31 Aug (A): Thu P5, P6; week of 7 Sep (B): Tue, Fri. The four Lessons fill the
		// first two weeks, and the third week is the free one.
		expect(rows.map((w) => [w.weekCommencing, w.letter])).toEqual([
			['2026-08-31', 'A'],
			['2026-09-07', 'B'],
			['2026-09-14', 'A']
		]);
		expect(rows[0].cells.map((c) => [c.key, c.kind])).toEqual([
			['2026-09-03|5', 'lesson'],
			['2026-09-03|6', 'lesson']
		]);
		expect(rows[2].cells.every((c) => c.kind === 'free')).toBe(true);
		// Every other Open Slot to the end of the year is counted in one number.
		const total = classSchedule(db, { classId: classA.id, today }).openSlots.length;
		expect(view.freeAfter).toBe(total - rows[2].cells.length);
	});

	test('starts at the week of the first untaught Lesson and keeps a taught Lesson as a fixed cell', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 6);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });
		// Lesson 1 and 2 are taught on 3 Sep; the first untaught Lesson falls in the next week.
		const on = '2026-09-04';
		const view = weeksOf(db, classA.id, on);

		expect(view.entries.filter((e) => e.fixed).map((e) => e.lessonId)).toEqual([
			lessons[0].id,
			lessons[1].id
		]);
		const first = view.weeks[0];
		expect(first.kind === 'week' && first.weekCommencing).toBe('2026-09-07');
	});

	test('shows a School Holiday as a thin row between two weeks', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 20);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-10-19' });

		const view = weeksOf(db, classA.id, '2026-10-19');
		const holiday = view.weeks.find((w) => w.kind === 'holiday');
		expect(holiday).toEqual({ kind: 'holiday', from: '2026-10-26', to: '2026-10-30' });
		const at = view.weeks.indexOf(holiday!);
		expect(view.weeks[at - 1].kind).toBe('week');
		expect(view.weeks[at + 1].kind).toBe('week');
	});

	test('a Placement is a fixed cell in its Slot, and a blocked Slot is a blocked cell', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 4);
		const [placed] = makeLessons(db, makeTopic(db, course.id, 'Extras').id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });
		const anchor = classSchedule(db, { classId: classA.id, today }).scheduled[1];
		db.insert(schema.placement)
			.values({
				classId: classA.id,
				date: anchor.date,
				slotId: anchor.slotId,
				lessonId: placed.id
			})
			.run();
		rederive(db, classA.id, today);

		const cells = weeksOf(db, classA.id).weeks.flatMap((w) => (w.kind === 'week' ? w.cells : []));
		const cell = cells.find((c) => c.key === `${anchor.date}|${anchor.period}`)!;
		expect(cell.kind).toBe('placed');
		expect(cell.title).toBe(placed.title);
		// The Placement is not in the Sequence, and the Sequence Lessons go round it.
		expect(cells.filter((c) => c.kind === 'lesson').map((c) => c.lessonId)).toEqual(
			lessons.map((l) => l.id)
		);
	});

	test('lists each Lesson with no Slot left as past the end, only when one exists', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });
		expect(weeksOf(db, classA.id).pastEnd).toEqual([]);

		const total = classSchedule(db, { classId: classA.id, today }).openSlots.length;
		const long = makeTopic(db, course.id, 'Long');
		const lessons = makeLessons(db, long.id, total + 2);
		assignTopic(db, { classId: classA.id, topicId: long.id, today });

		expect(weeksOf(db, classA.id).pastEnd).toEqual(lessons.slice(-2).map((l) => l.id));
	});

	test('counts each Topic in the Sequence by its untaught Lessons', () => {
		const { db, course, classA } = setUp();
		const forces = makeTopic(db, course.id, 'Forces');
		makeLessons(db, forces.id, 3);
		const waves = makeTopic(db, course.id, 'Waves');
		makeLessons(db, waves.id, 2);
		assignTopic(db, { classId: classA.id, topicId: waves.id, today });
		assignTopic(db, { classId: classA.id, topicId: forces.id, today });
		// Lesson 1 of Waves is taught on 3 Sep.
		const view = weeksOf(db, classA.id, '2026-09-04');

		expect(view.chips).toEqual([
			{ topicId: waves.id, name: 'Waves', untaught: 0 },
			{ topicId: forces.id, name: 'Forces', untaught: 3 }
		]);
	});
});

describe('the Sequence view flags', () => {
	test('onlyHere is true for a Standalone Lesson only this Class holds, not for one shared or a Topic Lesson', () => {
		const { db, course, classA, classB } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [topicLesson] = makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });
		const mine = addLesson(db, { classId: classA.id, title: 'Mine', today }).lesson;
		const shared = addLesson(db, { classId: classA.id, title: 'Shared', today }).lesson;
		db.insert(schema.classLesson)
			.values({ classId: classB.id, lessonId: shared.id, position: 0 })
			.run();

		const flags = new Map(
			sequenceView(db, { classId: classA.id, today })!.entries.map((e) => [e.lessonId, e.onlyHere])
		);

		expect(flags.get(mine.id)).toBe(true);
		expect(flags.get(shared.id)).toBe(false);
		expect(flags.get(topicLesson.id)).toBe(false);
	});

	test('counted includes a Topic Lesson in the Sequence and one Placed on this Class', () => {
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
		db.insert(schema.classLesson)
			.values({ classId: classA.id, lessonId: lessons[0].id, position: 0 })
			.run();

		const option = sequenceView(db, { classId: classA.id, today })!.topics.find(
			(t) => t.id === topic.id
		)!;

		expect(option).toMatchObject({ lessonCount: 3, counted: 2 });
	});
});
