import {} from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, refused } from './fixtures';
import { assignTopic, blockDay, classSchedule, moveLessons, placeLesson } from './index';
import type { Db } from './derive';
import * as schema from '../db/schema';
import { today, taughtOrder, sessionRows, withSequence } from './sequence-fixtures';

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
		expect(report.changed.length).toBe(2);
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
		const { db, classA, ids } = withSequence(4);
		const slot = classSchedule(db, { classId: classA.id, today }).openSlots[0];
		const placed = placeLesson(db, {
			classId: classA.id,
			date: slot.date,
			period: slot.period,
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
