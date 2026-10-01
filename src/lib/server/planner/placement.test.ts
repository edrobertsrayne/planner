import { and, eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, refused, setUp } from './fixtures';
import { assignTopic, classSchedule, placeLesson, removePlacement, setReadiness } from './index';
import * as schema from '../db/schema';

describe('placing a Lesson', () => {
	test('creates a Standalone Lesson and a Placement together, and re-derives the Class', () => {
		const { db, client, classA } = setUp();
		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3)!;

		const result = placeLesson(db, client, {
			classId: classA.id,
			date: '2026-09-14',
			slotId: mondaySlot.id,
			title: 'Assembly',
			today: '2026-09-03'
		});
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

	test('rolls back the freshly created Lesson when the Placement insert collides on a taken anchor', () => {
		const { db, client, classA } = setUp();
		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3)!;

		placeLesson(db, client, {
			classId: classA.id,
			date: '2026-09-14',
			slotId: mondaySlot.id,
			title: 'Assembly',
			today: '2026-09-03'
		});

		expect(() =>
			placeLesson(db, client, {
				classId: classA.id,
				date: '2026-09-14',
				slotId: mondaySlot.id,
				title: 'Fire drill',
				today: '2026-09-03'
			})
		).toThrow();

		const lessons = db.select().from(schema.lesson).all();
		expect(lessons).toHaveLength(1);
		expect(lessons[0].title).toBe('Assembly');
	});

	test('refuses a date before today, creating neither the Lesson nor the Placement', () => {
		const { db, client, classA } = setUp();
		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3)!;

		refused(
			() =>
				placeLesson(db, client, {
					classId: classA.id,
					date: '2026-09-01',
					slotId: mondaySlot.id,
					title: 'Assembly',
					today: '2026-09-03'
				}),
			'invalid',
			'"2026-09-01" is in the past. A Placement is made for today or a later date, never a past one.'
		);
		expect(db.select().from(schema.lesson).all()).toHaveLength(0);
		expect(db.select().from(schema.placement).all()).toHaveLength(0);
	});

	// The mid-Topic throw-in (issue #256): the Slot chosen already carries a Topic Lesson, so the
	// Placement claims it ahead of the Topic stream and the whole sequence moves on past it. No
	// new mechanism — `layPlacements` runs before `layOut` — so this test pins the behaviour the
	// widened door now exposes.
	test('placing onto a Slot a Topic Lesson holds shift-rights that Lesson and the rest', () => {
		const { db, client, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [first, second, third] = makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const before = classSchedule(db, { classId: classA.id, today: '2026-09-03' }).scheduled;
		expect(before.slice(0, 3).map((s) => s.lessonId)).toEqual([first.id, second.id, third.id]);

		// The second Lesson's own occasion — the middle of the sequence, not a gap after it.
		const target = before[1];
		const result = placeLesson(db, client, {
			classId: classA.id,
			date: target.date,
			slotId: target.slotId,
			title: 'Assembly',
			today: '2026-09-03'
		});

		const after = classSchedule(db, { classId: classA.id, today: '2026-09-03' }).scheduled;
		expect(after.slice(0, 4).map((s) => s.lessonId)).toEqual([
			first.id,
			result.lesson.id,
			second.id,
			third.id
		]);
		expect(after[1]).toMatchObject({ date: target.date, period: target.period });
	});
});

describe('removing a Placement', () => {
	test('re-derives the one Class from rewindBoundary, and is a no-op for an unknown id', () => {
		const { db, client, classA } = setUp();
		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3)!;

		const placed = placeLesson(db, client, {
			classId: classA.id,
			date: '2026-09-14',
			slotId: mondaySlot.id,
			title: 'Assembly',
			today: '2026-09-03'
		});

		const [placement] = db.select().from(schema.placement).all();

		const report = removePlacement(db, { id: placement.id, today: '2026-09-01' });
		expect(report).not.toBeNull();

		const schedule = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		expect(schedule.scheduled.find((s) => s.lessonId === placed.lesson.id)).toBeUndefined();
		expect(db.select().from(schema.placement).all()).toHaveLength(0);

		// The Lesson itself survives — no Placement names it now, so it stands as a Standalone
		// Lesson (retired), not deleted (ADR-0022).
		const survivingLessons = db.select().from(schema.lesson).all();
		expect(survivingLessons).toHaveLength(1);
		expect(survivingLessons[0]).toMatchObject({ id: placed.lesson.id, topicId: null });

		expect(removePlacement(db, { id: 'does-not-exist', today: '2026-09-03' })).toBeNull();
	});

	test('allows a past-dated removal, the same as unblockSlot', () => {
		const { db, client, classA } = setUp();
		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3)!;

		const today = '2026-09-01';
		placeLesson(db, client, {
			classId: classA.id,
			date: '2026-09-14',
			slotId: mondaySlot.id,
			title: 'Assembly',
			today
		});

		const [placement] = db.select().from(schema.placement).all();

		// today has moved on past the Placement's own date — a Rewind, mirroring unblockSlot's
		// no past-date refusal.
		removePlacement(db, { id: placement.id, today: '2026-09-20' });
		expect(db.select().from(schema.placement).all()).toHaveLength(0);
	});
});

describe('Readiness and a removed Placement', () => {
	test('survives while a second Placement still names the pair, and dies when the last one goes', () => {
		const { db, client, classA } = setUp();
		const today = '2026-09-03';
		const slots = db.select().from(schema.slot).all();
		const mondaySlot = slots.find(
			(s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3
		)!;
		const wednesdaySlot = slots.find(
			(s) => s.classId === classA.id && s.week === 'A' && s.day === 3 && s.period === 1
		)!;

		const placed = placeLesson(db, client, {
			classId: classA.id,
			date: '2026-09-14',
			slotId: mondaySlot.id,
			title: 'Assembly',
			today
		});
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
