import { describe, expect, test } from 'vitest';
import { refused } from './fixtures';
import { classSchedule, movePlacement, placeLesson } from './index';
import type { Db } from './derive';
import * as schema from '../db/schema';
import { today, withSequence } from './sequence-fixtures';

function placedAt(
	db: Db,
	classId: string,
	slot: { date: string; period: number },
	title = 'Assembly'
) {
	const { lesson } = placeLesson(db, { classId, ...slot, title, today });
	const [row] = db
		.select()
		.from(schema.placement)
		.all()
		.filter((p) => p.lessonId === lesson.id);
	return { lesson, placement: row };
}

const where = (db: Db, classId: string, lessonId: string) => {
	const { history, scheduled } = classSchedule(db, { classId, today });
	return [...history, ...scheduled].find((s) => s.lessonId === lessonId);
};

describe('moving a Placement', () => {
	test('re-anchors it on another Open Slot, leaving the Sequence where it was', () => {
		const { db, classA, ids } = withSequence(2);
		const [from, to] = classSchedule(db, { classId: classA.id, today }).openSlots.slice(0, 2);
		const { lesson, placement } = placedAt(db, classA.id, from);
		const sequenceBefore = classSchedule(db, { classId: classA.id, today })
			.scheduled.filter((s) => ids.includes(s.lessonId))
			.map((s) => [s.lessonId, s.date, s.period]);

		const result = movePlacement(db, { id: placement.id, date: to.date, period: to.period, today });

		expect(where(db, classA.id, lesson.id)).toMatchObject({ date: to.date, period: to.period });
		const [row] = db.select().from(schema.placement).all();
		expect(row).toMatchObject({ id: placement.id, date: to.date, slotId: to.slotId });
		expect(result.changed).toEqual([]);
		expect(
			classSchedule(db, { classId: classA.id, today })
				.scheduled.filter((s) => ids.includes(s.lessonId))
				.map((s) => [s.lessonId, s.date, s.period])
		).toEqual(sequenceBefore);
	});

	test('onto a Slot a Sequence Lesson holds, that Lesson and those after it move on, and a new date is reported', () => {
		const { db, classA, ids } = withSequence(3);
		const schedule = classSchedule(db, { classId: classA.id, today });
		const { placement } = placedAt(db, classA.id, schedule.openSlots[0]);
		const held = schedule.scheduled.find((s) => s.lessonId === ids[0])!;

		const result = movePlacement(db, {
			id: placement.id,
			date: held.date,
			period: held.period,
			today
		});

		expect(where(db, classA.id, ids[0])).not.toMatchObject({
			date: held.date,
			period: held.period
		});
		expect(result.changed.map((c) => c.lessonId)).toEqual([ids[1], ids[2]]);
	});

	test('refuses a Slot another Placement holds, and changes nothing', () => {
		const { db, classA } = withSequence(1);
		const [a, b] = classSchedule(db, { classId: classA.id, today }).openSlots.slice(0, 2);
		const first = placedAt(db, classA.id, a, 'First');
		placedAt(db, classA.id, b, 'Second');

		refused(
			() => movePlacement(db, { id: first.placement.id, date: b.date, period: b.period, today }),
			'conflict',
			`${b.date} P${b.period} already holds a placed Lesson.`
		);
		expect(where(db, classA.id, first.lesson.id)).toMatchObject({ date: a.date, period: a.period });
	});

	test('refuses a past date', () => {
		const { db, classA } = withSequence(1);
		const [from] = classSchedule(db, { classId: classA.id, today }).openSlots;
		const { placement } = placedAt(db, classA.id, from);

		refused(
			() => movePlacement(db, { id: placement.id, date: '2026-08-31', period: 1, today }),
			'invalid',
			'"2026-08-31" is in the past. A Placement is made for today or a later date, never a past one.'
		);
	});

	test('refuses a Placement already taught', () => {
		const { db, classA } = withSequence(1);
		const [from, to] = classSchedule(db, { classId: classA.id, today }).openSlots.slice(0, 2);
		const { placement } = placedAt(db, classA.id, from);
		const later = to.date;

		refused(
			() => movePlacement(db, { id: placement.id, date: to.date, period: to.period, today: later }),
			'conflict',
			'This Placement has been taught, so it cannot move.'
		);
	});

	test('names a Placement that does not exist', () => {
		const { db } = withSequence(1);
		refused(
			() => movePlacement(db, { id: 'nope', date: '2026-09-14', period: 1, today }),
			'missing',
			'No such Placement.'
		);
	});
});
