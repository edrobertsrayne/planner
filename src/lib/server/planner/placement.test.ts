import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, refused, setUp } from './fixtures';
import {
	assignTopic,
	blockDay,
	blockSlot,
	classSchedule,
	placeLesson,
	placementAdmission,
	removePlacement,
	setReadiness
} from './index';
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
			period: mondaySlot.period,
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

	test('refuses a second Placement on the occasion a Placement already holds, creating no Lesson', () => {
		const { db, classA } = setUp();
		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3)!;

		placeLesson(db, {
			classId: classA.id,
			date: '2026-09-14',
			period: mondaySlot.period,
			title: 'Assembly',
			today: '2026-09-03'
		});

		expect(() =>
			placeLesson(db, {
				classId: classA.id,
				date: '2026-09-14',
				period: mondaySlot.period,
				title: 'Fire drill',
				today: '2026-09-03'
			})
		).toThrow('2026-09-14 P3 already holds a placed Lesson.');

		const lessons = db.select().from(schema.lesson).all();
		expect(lessons).toHaveLength(1);
		expect(lessons[0].title).toBe('Assembly');
	});

	test('refuses a date before today, creating neither the Lesson nor the Placement', () => {
		const { db, classA } = setUp();
		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3)!;

		refused(
			() =>
				placeLesson(db, {
					classId: classA.id,
					date: '2026-09-01',
					period: mondaySlot.period,
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
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [first, second, third] = makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const before = classSchedule(db, { classId: classA.id, today: '2026-09-03' }).scheduled;
		expect(before.slice(0, 3).map((s) => s.lessonId)).toEqual([first.id, second.id, third.id]);

		// The second Lesson's own occasion — the middle of the sequence, not a gap after it.
		const target = before[1];
		const result = placeLesson(db, {
			classId: classA.id,
			date: target.date,
			period: target.period,
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
		const { db, classA } = setUp();
		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3)!;

		const placed = placeLesson(db, {
			classId: classA.id,
			date: '2026-09-14',
			period: mondaySlot.period,
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
		const { db, classA } = setUp();
		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3)!;

		const today = '2026-09-01';
		placeLesson(db, {
			classId: classA.id,
			date: '2026-09-14',
			period: mondaySlot.period,
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
	test('removing a Placement ends the Readiness of its (Lesson, Class) pairing', () => {
		const { db, classA } = setUp();
		const today = '2026-09-03';
		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3)!;

		const { lesson } = placeLesson(db, {
			classId: classA.id,
			date: '2026-09-14',
			period: mondaySlot.period,
			title: 'Assembly',
			today
		});

		setReadiness(db, lesson.id, classA.id, true);
		const readinessRows = () =>
			db.select().from(schema.readiness).where(eq(schema.readiness.lessonId, lesson.id)).all();
		expect(readinessRows()).toHaveLength(1);

		const [placement] = db.select().from(schema.placement).all();
		removePlacement(db, { id: placement.id, today });

		// Its one Placement gone, the (Lesson, Class) pairing no longer exists, so Readiness dies
		// with it.
		expect(readinessRows()).toHaveLength(0);
	});

	test('removing a Placement deletes the Teaching note of its (Lesson, Class), leaving the same Lesson on another Class alone', () => {
		const { db, classA, classB } = setUp();
		const today = '2026-09-03';
		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3)!;

		const { lesson } = placeLesson(db, {
			classId: classA.id,
			date: '2026-09-14',
			period: mondaySlot.period,
			title: 'Assembly',
			today
		});
		// The same Lesson on another Class has a note of its own.
		db.insert(schema.teachingNote)
			.values([
				{ classId: classA.id, lessonId: lesson.id, body: 'Hall B' },
				{ classId: classB.id, lessonId: lesson.id, body: 'Other class' }
			])
			.run();
		const notes = () =>
			db
				.select()
				.from(schema.teachingNote)
				.all()
				.map((n) => [n.classId, n.body]);
		expect(notes()).toHaveLength(2);

		const [placement] = db.select().from(schema.placement).all();
		removePlacement(db, { id: placement.id, today });

		expect(notes()).toEqual([[classB.id, 'Other class']]);
	});
});

// ADR-0025: every Placement rule lives behind the seam, and the one admission answer feeds the
// Session panel, the Calendar day menu and the door alike.
describe('whether a Lesson may be placed on an occasion', () => {
	const TODAY = '2026-09-03';

	// The Monday of Week A, an occasion 9B/Sc1 holds P3 on.
	const monday = (db: ReturnType<typeof setUp>['db'], classId: string) =>
		db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classId && s.week === 'A' && s.day === 1 && s.period === 3)!;

	// The seam and the door agree: the admission's answer is exactly what placeLesson does.
	function expectRefused(
		db: ReturnType<typeof setUp>['db'],
		occasion: { classId: string; date: string; period: number },
		kind: 'invalid' | 'conflict',
		reason: string
	) {
		expect(placementAdmission(db, { ...occasion, today: TODAY })).toEqual({
			admitted: false,
			kind,
			reason
		});
		refused(() => placeLesson(db, { ...occasion, title: 'Clash', today: TODAY }), kind, reason);
	}

	test('an Open Slot is admitted, and the Lesson lands there', () => {
		const { db, classA } = setUp();
		const occasion = { classId: classA.id, date: '2026-09-14', period: 3 };
		expect(placementAdmission(db, { ...occasion, today: TODAY })).toEqual({
			admitted: true,
			slotId: monday(db, classA.id).id
		});

		const placed = placeLesson(db, { ...occasion, title: 'Assembly', today: TODAY });
		const schedule = classSchedule(db, { classId: classA.id, today: TODAY });
		expect(schedule.scheduled).toContainEqual(
			expect.objectContaining({ date: occasion.date, period: 3, lessonId: placed.lesson.id })
		);
	});

	test('a Slot a Topic Lesson holds is admitted, and that Lesson shifts right', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [first, second] = makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: TODAY });

		const before = classSchedule(db, { classId: classA.id, today: TODAY }).scheduled;
		const held = before.find((s) => s.lessonId === first.id)!;
		const occasion = { classId: classA.id, date: held.date, period: held.period };
		expect(placementAdmission(db, { ...occasion, today: TODAY }).admitted).toBe(true);

		const placed = placeLesson(db, { ...occasion, title: 'Assembly', today: TODAY });
		const after = classSchedule(db, { classId: classA.id, today: TODAY }).scheduled;
		expect(after.slice(0, 2).map((s) => s.lessonId)).toEqual([placed.lesson.id, first.id]);
		expect(after.map((s) => s.lessonId)).toContain(second.id);
	});

	test('an occasion that already holds a placed Lesson is a conflict', () => {
		const { db, classA } = setUp();
		const occasion = { classId: classA.id, date: '2026-09-14', period: 3 };
		placeLesson(db, { ...occasion, title: 'Assembly', today: TODAY });

		expectRefused(db, occasion, 'conflict', '2026-09-14 P3 already holds a placed Lesson.');
	});

	test('a Blocked Slot is not an Available Slot', () => {
		const { db, classA } = setUp();
		const slot = monday(db, classA.id);
		blockSlot(db, {
			classId: classA.id,
			date: '2026-09-14',
			slotId: slot.id,
			note: 'Exam',
			today: TODAY
		});

		expectRefused(
			db,
			{ classId: classA.id, date: '2026-09-14', period: 3 },
			'invalid',
			'2026-09-14 P3 is not an Available Slot.'
		);
	});

	test('a Blocked Day is not an Available Slot', () => {
		const { db, classA } = setUp();
		blockDay(db, { date: '2026-09-14', note: 'INSET', today: TODAY });

		expectRefused(
			db,
			{ classId: classA.id, date: '2026-09-14', period: 3 },
			'invalid',
			'2026-09-14 P3 is not an Available Slot.'
		);
	});

	test('a Period the Class does not hold is not an Available Slot', () => {
		const { db, classA } = setUp();

		expectRefused(
			db,
			{ classId: classA.id, date: '2026-09-14', period: 1 },
			'invalid',
			'2026-09-14 P1 is not an Available Slot.'
		);
	});

	test('a past date is refused by the admission, before any Slot is looked up', () => {
		const { db, classA } = setUp();

		expectRefused(
			db,
			{ classId: classA.id, date: '2026-09-01', period: 3 },
			'invalid',
			'"2026-09-01" is in the past. A Placement is made for today or a later date, never a past one.'
		);
	});
});
