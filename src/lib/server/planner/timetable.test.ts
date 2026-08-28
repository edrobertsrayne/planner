import { and, eq, lt } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, setUp } from './fixtures';
import {
	activeSlots,
	addSlot,
	assignTopic,
	classSchedule,
	clearSlot,
	createClass,
	datedSlotsOf,
	endSlot,
	holderAt,
	takeSlot
} from './index';
import * as schema from '../db/schema';

describe('Slot uniqueness is window-aware, enforced in the server module', () => {
	test('a Slot clashing with another Class over overlapping hold dates is rejected', () => {
		const { db, course } = setUp();
		const classC = createClass(db, { label: '9C/Sc2', courseId: course.id })!;

		// classA already holds Week A Mon P3 for the whole year (setUp).
		expect(() => addSlot(db, { classId: classC.id, week: 'A', day: 1, period: 3 })).toThrow();

		// Still clashes even when the new Slot only partially overlaps the existing one.
		expect(() =>
			addSlot(db, {
				classId: classC.id,
				week: 'A',
				day: 1,
				period: 3,
				holdsFrom: '2027-01-04'
			})
		).toThrow();
	});

	test('replacing a Slot mid-year — ending one, starting another the next day — is accepted', () => {
		const { db, course, classA } = setUp();
		const classC = createClass(db, { label: '9C/Sc2', courseId: course.id })!;

		const [original] = db
			.select()
			.from(schema.slot)
			.where(
				and(
					eq(schema.slot.classId, classA.id),
					eq(schema.slot.week, 'A'),
					eq(schema.slot.day, 1),
					eq(schema.slot.period, 3)
				)
			)
			.all();

		endSlot(db, { id: original.id, from: '2027-01-04', today: '2026-11-01' });
		const replacement = addSlot(db, {
			classId: classC.id,
			week: 'A',
			day: 1,
			period: 3,
			holdsFrom: '2027-01-04'
		});

		expect(replacement).toBeTruthy();
		const atPosition = (on: string) =>
			activeSlots(db, on).find((s) => s.week === 'A' && s.day === 1 && s.period === 3);
		expect(atPosition('2027-01-01')?.classId).toBe(classA.id);
		expect(atPosition('2027-01-04')?.classId).toBe(classC.id);
	});

	test('takeSlot gives an empty position to a Class, from the chosen date', () => {
		const { db, course } = setUp();
		const classC = createClass(db, { label: '9C/Sc2', courseId: course.id })!;

		// Week A Wed P6 is empty in setUp.
		takeSlot(db, {
			classId: classC.id,
			week: 'A',
			day: 3,
			period: 6,
			from: '2027-01-04',
			today: '2026-11-01'
		});

		const atPosition = (on: string) =>
			activeSlots(db, on).find((s) => s.week === 'A' && s.day === 3 && s.period === 6);
		expect(atPosition('2026-12-01')).toBeUndefined();
		expect(atPosition('2027-01-04')?.classId).toBe(classC.id);
	});

	test('takeSlot refuses a position already held by another Class', () => {
		const { db, course } = setUp();
		const classC = createClass(db, { label: '9C/Sc2', courseId: course.id })!;

		// classA already holds Week A Mon P3 for the whole year (setUp) — a Period held by
		// another Class cannot be taken.
		expect(() =>
			takeSlot(db, {
				classId: classC.id,
				week: 'A',
				day: 1,
				period: 3,
				from: '2027-01-04',
				today: '2026-11-01'
			})
		).toThrow();
	});

	test('takeSlot on a position already held by the clicking Class is a no-op', () => {
		const { db, classA } = setUp();
		const before = datedSlotsOf(db, classA.id);

		const held = takeSlot(db, {
			classId: classA.id,
			week: 'A',
			day: 1,
			period: 3,
			from: null,
			today: '2026-11-01'
		});

		expect(held).toBeTruthy();
		expect(datedSlotsOf(db, classA.id)).toEqual(before);
	});

	test('takeSlot still refuses a future clash the grid cannot show at the chosen date', () => {
		const { db, course } = setUp();
		const classC = createClass(db, { label: '9C/Sc2', courseId: course.id })!;
		const classD = createClass(db, { label: '9D/Sc3', courseId: course.id })!;

		// classC holds Week A Wed P6 (empty in setUp) only from next summer — nothing is there
		// yet on any date before then, so the position reads as empty today.
		takeSlot(db, {
			classId: classC.id,
			week: 'A',
			day: 3,
			period: 6,
			from: '2027-06-01',
			today: '2026-11-01'
		});
		expect(holderAt(db, { week: 'A', day: 3, period: 6, on: '2026-11-01' })).toBeNull();

		// Taking it from the start of the year — unbounded — collides with that later Slot even
		// though nothing was visibly hatched at the date being edited.
		expect(() =>
			takeSlot(db, {
				classId: classD.id,
				week: 'A',
				day: 3,
				period: 6,
				from: null,
				today: '2026-11-01'
			})
		).toThrow();
	});

	test('clearSlot ends the Class own Slot at the position, from the chosen date', () => {
		const { db, classA } = setUp();

		clearSlot(db, {
			classId: classA.id,
			week: 'A',
			day: 1,
			period: 3,
			from: '2027-01-04',
			today: '2026-11-01'
		});

		expect(
			activeSlots(db, '2026-12-01').find((s) => s.day === 1 && s.period === 3 && s.week === 'A')
		).toBeTruthy();
		expect(
			activeSlots(db, '2027-01-04').find((s) => s.day === 1 && s.period === 3 && s.week === 'A')
		).toBeFalsy();
	});

	test('study leave: ending a Slot mid-year re-derives forward from today and does not rewrite Sessions already taught', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 200);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const taughtBefore = db
			.select()
			.from(schema.session)
			.where(and(eq(schema.session.classId, classA.id), lt(schema.session.date, '2026-11-24')))
			.all();
		expect(taughtBefore.length).toBeGreaterThan(0);

		const [wednesday] = db
			.select()
			.from(schema.slot)
			.where(
				and(
					eq(schema.slot.classId, classA.id),
					eq(schema.slot.week, 'A'),
					eq(schema.slot.day, 3),
					eq(schema.slot.period, 1)
				)
			)
			.all();

		const scheduledBefore = classSchedule(db, {
			classId: classA.id,
			today: '2026-11-24'
		}).scheduled;

		endSlot(db, { id: wednesday.id, from: '2027-05-15', today: '2026-11-24' });

		const stillTaught = db
			.select()
			.from(schema.session)
			.where(and(eq(schema.session.classId, classA.id), lt(schema.session.date, '2026-11-24')))
			.all();
		expect(stillTaught).toEqual(taughtBefore);

		// The Wednesday P1 Slot is gone from 15 May, so from then on every scheduled Session has
		// moved onto one of the Class's remaining Slots — never that position, on or after that
		// date — and the Class has fewer Available Slots to lay Lessons onto than before.
		const scheduledAfter = classSchedule(db, { classId: classA.id, today: '2026-11-24' }).scheduled;
		expect(scheduledAfter.length).toBeLessThan(scheduledBefore.length);
		expect(
			scheduledAfter.some((s) => s.date >= '2027-05-15' && s.period === 1 && s.week === 'A')
		).toBe(false);
	});
});
