import { and, eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { setUp } from './fixtures';
import { classSchedule, placeLesson, removePlacement, setReadiness } from './index';
import * as schema from '../db/schema';

describe('placing a Lesson', () => {
	test('creates a Standalone Lesson and a Placement together, and re-derives the Class', () => {
		const { db, classA } = setUp();
		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3)!;

		const result = placeLesson(db, {
			classId: classA.id,
			date: '2026-09-14',
			slotId: mondaySlot.id,
			title: 'Assembly',
			today: '2026-09-03'
		});
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error('unreachable');
		expect(result.lesson).toMatchObject({ topicId: null, position: 0, title: 'Assembly' });

		const [placement] = db
			.select()
			.from(schema.placement)
			.where(eq(schema.placement.lessonId, result.lesson.id))
			.all();
		expect(placement).toMatchObject({
			classId: classA.id,
			date: '2026-09-14',
			slotId: mondaySlot.id,
			lessonId: result.lesson.id
		});

		const schedule = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		expect(schedule.scheduled).toContainEqual(
			expect.objectContaining({ date: '2026-09-14', lessonId: result.lesson.id })
		);
	});

	test('refuses a date before today, creating neither the Lesson nor the Placement', () => {
		const { db, classA } = setUp();
		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3)!;

		const result = placeLesson(db, {
			classId: classA.id,
			date: '2026-09-01',
			slotId: mondaySlot.id,
			title: 'Assembly',
			today: '2026-09-03'
		});

		expect(result).toEqual({
			ok: false,
			status: 400,
			reason:
				'"2026-09-01" is in the past. A Placement is made for today or a later date, never a past one.'
		});
		expect(db.select().from(schema.lesson).all()).toHaveLength(0);
		expect(db.select().from(schema.placement).all()).toHaveLength(0);
	});
});

describe('removing a Placement', () => {
	test('re-derives the one Class from rewindBoundary, and is a no-op for an unknown id', () => {
		const { db, classA } = setUp();
		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3)!;

		const placed = placeLesson(db, {
			classId: classA.id,
			date: '2026-09-14',
			slotId: mondaySlot.id,
			title: 'Assembly',
			today: '2026-09-03'
		});
		expect(placed.ok).toBe(true);
		if (!placed.ok) throw new Error('unreachable');

		const [placement] = db.select().from(schema.placement).all();

		const report = removePlacement(db, { id: placement.id, today: '2026-09-01' });
		expect(report).not.toBeNull();

		const schedule = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		expect(schedule.scheduled.find((s) => s.lessonId === placed.lesson.id)).toBeUndefined();
		expect(db.select().from(schema.placement).all()).toHaveLength(0);

		expect(removePlacement(db, { id: 'does-not-exist', today: '2026-09-03' })).toBeNull();
	});

	test('allows a past-dated removal, the same as unblockSlot', () => {
		const { db, classA } = setUp();
		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3)!;

		const today = '2026-09-01';
		const placed = placeLesson(db, {
			classId: classA.id,
			date: '2026-09-14',
			slotId: mondaySlot.id,
			title: 'Assembly',
			today
		});
		expect(placed.ok).toBe(true);
		if (!placed.ok) throw new Error('unreachable');

		const [placement] = db.select().from(schema.placement).all();

		// today has moved on past the Placement's own date — a Rewind, mirroring unblockSlot's
		// no past-date refusal.
		removePlacement(db, { id: placement.id, today: '2026-09-20' });
		expect(db.select().from(schema.placement).all()).toHaveLength(0);
	});
});

describe('Readiness and a removed Placement', () => {
	test('survives while a second Placement still names the pair, and dies when the last one goes', () => {
		const { db, classA } = setUp();
		const today = '2026-09-03';
		const slots = db.select().from(schema.slot).all();
		const mondaySlot = slots.find(
			(s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3
		)!;
		const wednesdaySlot = slots.find(
			(s) => s.classId === classA.id && s.week === 'A' && s.day === 3 && s.period === 1
		)!;

		const placed = placeLesson(db, {
			classId: classA.id,
			date: '2026-09-14',
			slotId: mondaySlot.id,
			title: 'Assembly',
			today
		});
		expect(placed.ok).toBe(true);
		if (!placed.ok) throw new Error('unreachable');
		const lessonId = placed.lesson.id;

		// A second Placement of the same Lesson on the same Class, a different date and Slot.
		db.insert(schema.placement)
			.values({ classId: classA.id, date: '2026-09-16', slotId: wednesdaySlot.id, lessonId })
			.run();

		setReadiness(db, lessonId, classA.id, true);
		const readinessRows = () =>
			db
				.select()
				.from(schema.readiness)
				.where(
					and(eq(schema.readiness.lessonId, lessonId), eq(schema.readiness.classId, classA.id))
				)
				.all();
		expect(readinessRows()).toHaveLength(1);

		const [first] = db
			.select()
			.from(schema.placement)
			.where(eq(schema.placement.date, '2026-09-14'))
			.all();
		removePlacement(db, { id: first.id, today });
		expect(readinessRows()).toHaveLength(1);

		const [second] = db
			.select()
			.from(schema.placement)
			.where(eq(schema.placement.date, '2026-09-16'))
			.all();
		removePlacement(db, { id: second.id, today });
		expect(readinessRows()).toHaveLength(0);
	});
});
