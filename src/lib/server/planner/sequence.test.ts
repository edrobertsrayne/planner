import { and, eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, refused, setSequence, setUp } from './fixtures';
import {
	assignTopic,
	blockDay,
	classSchedule,
	fixedLessonIds,
	moveLessons,
	placeLesson,
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

// A Class with a Sequence of `count` Lessons from one Topic, laid out from `today`.
function withSequence(count: number) {
	const set = setUp();
	const topic = makeTopic(set.db, set.course.id, 'Forces');
	const lessons = makeLessons(set.db, topic.id, count);
	assignTopic(set.db, { classId: set.classA.id, topicId: topic.id, today });
	return { ...set, lessons, ids: lessons.map((l) => l.id) };
}

describe('Move', () => {
	test('one Lesson takes the place of a Lesson below it, and the Lessons between move up', () => {
		const { db, classA, ids } = withSequence(5);

		const report = moveLessons(db, {
			classId: classA.id,
			lessonIds: [ids[1]],
			targetId: ids[3],
			today
		});

		expect(taughtOrder(db, classA.id)).toEqual([ids[0], ids[2], ids[3], ids[1], ids[4]]);
		expect(report.placementsMoved).toEqual([]);
	});

	test('one Lesson takes the place of a Lesson above it, and the Lessons between move down', () => {
		const { db, classA, ids } = withSequence(5);

		moveLessons(db, { classId: classA.id, lessonIds: [ids[3]], targetId: ids[1], today });

		expect(taughtOrder(db, classA.id)).toEqual([ids[0], ids[3], ids[1], ids[2], ids[4]]);
	});

	test('a selection with gaps goes together, in its current order, after a target below', () => {
		const { db, classA, ids } = withSequence(7);

		// The caller may list the Lessons in any order. The Sequence's own order wins.
		moveLessons(db, {
			classId: classA.id,
			lessonIds: [ids[3], ids[1]],
			targetId: ids[5],
			today
		});

		expect(taughtOrder(db, classA.id)).toEqual([
			ids[0],
			ids[2],
			ids[4],
			ids[5],
			ids[1],
			ids[3],
			ids[6]
		]);
	});

	test('a selection with gaps goes together in front of a target above', () => {
		const { db, classA, ids } = withSequence(7);

		moveLessons(db, {
			classId: classA.id,
			lessonIds: [ids[4], ids[6]],
			targetId: ids[1],
			today
		});

		expect(taughtOrder(db, classA.id)).toEqual([
			ids[0],
			ids[4],
			ids[6],
			ids[1],
			ids[2],
			ids[3],
			ids[5]
		]);
	});

	test('reports each Lesson that got a new first date, with its old date', () => {
		const { db, classA, ids } = withSequence(3);
		const before = classSchedule(db, { classId: classA.id, today });
		const dateOf = (id: string) => before.scheduled.find((s) => s.lessonId === id)!.date;

		const report = moveLessons(db, {
			classId: classA.id,
			lessonIds: [ids[2]],
			targetId: ids[1],
			today
		});

		// Lessons 1 and 2 share a day (a double), so Lesson 2 moves from P6 to a later Slot.
		expect(report.lessonsChanged).toBe(2);
		expect(report.changed).toEqual([
			{ lessonId: ids[1], was: dateOf(ids[1]) },
			{ lessonId: ids[2], was: dateOf(ids[2]) }
		]);
	});

	test('a move back puts the Sequence as it was', () => {
		const { db, classA, ids } = withSequence(4);

		moveLessons(db, { classId: classA.id, lessonIds: [ids[0]], targetId: ids[2], today });
		moveLessons(db, { classId: classA.id, lessonIds: [ids[0]], targetId: ids[1], today });

		expect(taughtOrder(db, classA.id)).toEqual(ids);
	});

	test('refuses a fixed Lesson, and a target in front of a fixed Lesson', () => {
		const { db, classA, ids } = withSequence(5);
		// Lessons 1 and 2 fall on 3 Sep, and Lesson 3 on 8 Sep: all three are fixed on 8 Sep.
		const later = '2026-09-08';

		refused(
			() =>
				moveLessons(db, {
					classId: classA.id,
					lessonIds: [ids[0]],
					targetId: ids[4],
					today: later
				}),
			'conflict',
			'“Lesson 1” was taught, so it cannot move.'
		);
		refused(
			() =>
				moveLessons(db, {
					classId: classA.id,
					lessonIds: [ids[3], ids[0]],
					targetId: ids[4],
					today: later
				}),
			'conflict',
			'“Lesson 1” was taught, so it cannot move.'
		);
		refused(
			() =>
				moveLessons(db, {
					classId: classA.id,
					lessonIds: [ids[4]],
					targetId: ids[2],
					today: later
				}),
			'conflict',
			'A Lesson cannot go in front of “Lesson 3”, which was taught.'
		);
		expect(taughtOrder(db, classA.id, later)).toEqual(ids);

		// The first place after the taught Lessons is legal.
		moveLessons(db, { classId: classA.id, lessonIds: [ids[4]], targetId: ids[3], today: later });
		expect(taughtOrder(db, classA.id, later)).toEqual([...ids.slice(0, 3), ids[4], ids[3]]);
	});

	test('refuses Lessons outside the Sequence, and a target that is itself moved', () => {
		const { db, course, classA, ids } = withSequence(3);
		const [outside] = makeLessons(db, makeTopic(db, course.id, 'Waves').id, 1);
		const message = 'Those Lessons are not in this Sequence, or the target is one of them.';

		refused(
			() =>
				moveLessons(db, { classId: classA.id, lessonIds: [outside.id], targetId: ids[0], today }),
			'invalid',
			message
		);
		refused(
			() =>
				moveLessons(db, { classId: classA.id, lessonIds: [ids[0]], targetId: outside.id, today }),
			'invalid',
			message
		);
		refused(
			() => moveLessons(db, { classId: classA.id, lessonIds: [ids[0]], targetId: ids[0], today }),
			'invalid',
			message
		);
		refused(
			() => moveLessons(db, { classId: classA.id, lessonIds: [], targetId: ids[0], today }),
			'invalid',
			message
		);
	});

	test('changes no other Class', () => {
		const { db, course, classA, classB, ids } = withSequence(4);
		const waves = makeTopic(db, course.id, 'Waves');
		makeLessons(db, waves.id, 3);
		assignTopic(db, { classId: classB.id, topicId: waves.id, today });
		const rowsBefore = sessionRows(db, classB.id);
		const sequenceBefore = db
			.select()
			.from(schema.classLesson)
			.all()
			.filter((row) => row.classId === classB.id);

		moveLessons(db, { classId: classA.id, lessonIds: [ids[3]], targetId: ids[0], today });

		expect(sessionRows(db, classB.id)).toEqual(rowsBefore);
		expect(
			db
				.select()
				.from(schema.classLesson)
				.all()
				.filter((row) => row.classId === classB.id)
		).toEqual(sequenceBefore);
	});

	test('leaves a Placement on its date', () => {
		const { db, client, classA, ids } = withSequence(4);
		const slot = classSchedule(db, { classId: classA.id, today }).openSlots[0];
		const placed = placeLesson(db, client, {
			classId: classA.id,
			date: slot.date,
			slotId: slot.slotId,
			title: 'One-off',
			today
		});

		const report = moveLessons(db, {
			classId: classA.id,
			lessonIds: [ids[3]],
			targetId: ids[0],
			today
		});

		expect(report.placementsMoved).toEqual([]);
		const [row] = db.select().from(schema.placement).all();
		expect(row).toMatchObject({ date: slot.date, slotId: slot.slotId, lessonId: placed.lesson.id });
		const { history, scheduled } = classSchedule(db, { classId: classA.id, today });
		expect([...history, ...scheduled].find((s) => s.lessonId === placed.lesson.id)?.date).toBe(
			slot.date
		);
	});
});

// The four runs of #371, on 9B/Sc1 with Lessons 1 to 4 taught by Fri 11 Sep: a Move never reaches
// into the past, so a later Rewind lays the past again as it was taught.
describe('Rewind after a Move', () => {
	const taughtBy = '2026-09-11';

	function taughtRows(db: Db, classId: string, on: string) {
		return sessionRows(db, classId).filter((row) => row.date <= on);
	}

	test('a Lesson cannot go to the front, so the past stays as taught', () => {
		const { db, classA, ids } = withSequence(8);

		refused(
			() =>
				moveLessons(db, {
					classId: classA.id,
					lessonIds: [ids[7]],
					targetId: ids[0],
					today: taughtBy
				}),
			'conflict',
			'A Lesson cannot go in front of “Lesson 1”, which was taught.'
		);

		const past = taughtRows(db, classA.id, taughtBy);
		blockDay(db, { date: '2026-09-10', today: taughtBy });
		expect(taughtRows(db, classA.id, taughtBy)).toEqual(past);
	});

	test('a Lesson moved to just after the taught Lessons, and a Blocked Day in the taught past', () => {
		const { db, classA, ids } = withSequence(8);
		moveLessons(db, { classId: classA.id, lessonIds: [ids[7]], targetId: ids[4], today: taughtBy });
		const past = taughtRows(db, classA.id, taughtBy);
		expect(past.map((row) => row.lessonId)).toEqual(ids.slice(0, 4));

		// Tue 8 Sep carries Lesson 3. The Blocked Day pushes Lessons 3 and 4 to later Slots, and
		// the Lesson moved to the front of the untaught part stays after them.
		blockDay(db, { date: '2026-09-08', today: taughtBy });

		const order = taughtOrder(db, classA.id, taughtBy);
		expect(order).toEqual([...ids.slice(0, 4), ids[7], ...ids.slice(4, 7)]);
		const dateOf = (id: string) => sessionRows(db, classA.id).find((r) => r.lessonId === id)!.date;
		expect(dateOf(ids[2]) > '2026-09-08').toBe(true);
		expect(dateOf(ids[3]) > dateOf(ids[2])).toBe(true);
		expect(taughtRows(db, classA.id, '2026-09-07')).toEqual(
			past.filter((r) => r.date <= '2026-09-07')
		);
	});

	test('a Blocked Day before the moved Lesson changes nothing in the taught past', () => {
		const { db, classA, ids } = withSequence(8);
		moveLessons(db, { classId: classA.id, lessonIds: [ids[7]], targetId: ids[4], today: taughtBy });
		const past = taughtRows(db, classA.id, taughtBy);

		// Thu 10 Sep has no Slot of this Class.
		blockDay(db, { date: '2026-09-10', today: taughtBy });

		expect(taughtRows(db, classA.id, taughtBy)).toEqual(past);
	});

	test('a Blocked Day entered after the moved Lesson was taught moves only what comes later', () => {
		const { db, classA, ids } = withSequence(8);
		moveLessons(db, { classId: classA.id, lessonIds: [ids[7]], targetId: ids[4], today: taughtBy });
		// The moved Lesson falls on Mon 14 Sep and is taught. A Blocked Day for Wed 16 Sep
		// follows on 1 Oct.
		const onThe14th = '2026-09-14';
		const later = '2026-10-01';
		const taught = taughtRows(db, classA.id, later);
		const moved = classSchedule(db, { classId: classA.id, today: later });
		expect([...moved.history, ...moved.scheduled].find((s) => s.date === onThe14th)?.lessonId).toBe(
			ids[7]
		);

		blockDay(db, { date: '2026-09-16', today: later });

		expect(taughtRows(db, classA.id, '2026-09-15')).toEqual(
			taught.filter((r) => r.date <= '2026-09-15')
		);
		expect(taughtOrder(db, classA.id, later)).toEqual([
			...ids.slice(0, 4),
			ids[7],
			...ids.slice(4, 7)
		]);
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
