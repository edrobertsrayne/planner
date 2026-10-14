import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, refused, setUp } from './fixtures';
import {
	assignTopic,
	blockDay,
	blockSlot,
	classSchedule,
	sessionDetail,
	unblockDay,
	unblockSlot,
	writeTeachingNote
} from './index';
import * as schema from '../db/schema';

describe('Blocked Day', () => {
	test('shifts every later Lesson for every Class one Slot right, in order, dropping nothing', () => {
		const { db, course, classA, classB } = setUp();
		const topicA = makeTopic(db, course.id, 'Forces');
		const lessonsA = makeLessons(db, topicA.id, 6);
		const topicB = makeTopic(db, course.id, 'Waves');
		const lessonsB = makeLessons(db, topicB.id, 4);

		assignTopic(db, { classId: classA.id, topicId: topicA.id, today: '2026-09-03' });
		assignTopic(db, { classId: classB.id, topicId: topicB.id, today: '2026-09-03' });
		const before = {
			a: classSchedule(db, { classId: classA.id, today: '2026-09-03' }),
			b: classSchedule(db, { classId: classB.id, today: '2026-09-03' })
		};

		// Mon 14 Sep is a Week A Monday inside term, with no existing Blocked Day — both Classes
		// are taught that day (9B P3, 10C P1).
		const blockedDate = '2026-09-14';
		expect(before.a.scheduled.some((s) => s.date === blockedDate)).toBe(true);
		expect(before.b.scheduled.some((s) => s.date === blockedDate)).toBe(true);

		blockDay(db, { date: blockedDate, note: 'Snow day', today: '2026-09-03' });

		const afterA = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		const afterB = classSchedule(db, { classId: classB.id, today: '2026-09-03' });

		// Nothing before the blocked date moved, and no Lesson was dropped.
		const untilBlocked = (scheduled: typeof before.a.scheduled) =>
			scheduled.filter((s) => s.date < blockedDate);
		expect(untilBlocked(afterA.scheduled)).toEqual(untilBlocked(before.a.scheduled));
		expect(untilBlocked(afterB.scheduled)).toEqual(untilBlocked(before.b.scheduled));
		expect(afterA.scheduled.map((s) => s.lessonId)).toEqual(lessonsA.map((l) => l.id));
		expect(afterB.scheduled.map((s) => s.lessonId)).toEqual(lessonsB.map((l) => l.id));

		// No Session lands on the blocked date, and every Session that was due on or after it
		// slides right in order, onto the next Available Slots for that Class.
		expect(afterA.scheduled.some((s) => s.date === blockedDate)).toBe(false);
		expect(afterB.scheduled.some((s) => s.date === blockedDate)).toBe(false);
		const oldFromBlocked = before.a.scheduled.filter((s) => s.date >= blockedDate);
		const newFromBlocked = afterA.scheduled.filter((s) => s.date >= blockedDate);
		expect(newFromBlocked.map((s) => s.lessonId)).toEqual(oldFromBlocked.map((s) => s.lessonId));
		expect(newFromBlocked[0]).not.toEqual(oldFromBlocked[0]);
	});
});

describe('Blocked Slot', () => {
	test('moves one Class and leaves every other Class untouched', () => {
		const { db, course, classA, classB } = setUp();
		const topicA = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topicA.id, 6);
		const topicB = makeTopic(db, course.id, 'Waves');
		makeLessons(db, topicB.id, 4);

		assignTopic(db, { classId: classA.id, topicId: topicA.id, today: '2026-09-03' });
		assignTopic(db, {
			classId: classB.id,
			topicId: topicB.id,
			today: '2026-09-03'
		});
		const before = classSchedule(db, { classId: classB.id, today: '2026-09-03' });

		// 9B/Sc1's Mon 14 Sep P3 Slot (added first in setUp) is blocked; 10C/Ph2 is untouched.
		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3)!;

		blockSlot(db, {
			classId: classA.id,
			date: '2026-09-14',
			slotId: mondaySlot.id,
			note: 'Field trip',
			today: '2026-09-03'
		});

		const afterB = classSchedule(db, { classId: classB.id, today: '2026-09-03' });
		expect(afterB.scheduled).toEqual(before.scheduled);

		const afterA = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		expect(afterA.scheduled.some((s) => s.date === '2026-09-14' && s.period === 3)).toBe(false);
	});

	test('answers with the placementsMoved report only, and keeps the Teaching note with its Lesson', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [lesson] = makeLessons(db, topic.id, 1);

		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		writeTeachingNote(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			note: 'went badly — redo the practical'
		});

		const p5Slot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 4 && s.period === 5)!;

		// The trip was that same Period, entered after the fact: a Rewind lands directly on the
		// noted Session. The Lesson moves to P6, and the note goes with it.
		const report = blockSlot(db, {
			classId: classA.id,
			slotId: p5Slot.id,
			date: '2026-09-03',
			note: 'Field trip',
			today: '2026-09-10'
		});
		expect(report).toEqual({ placementsMoved: [] });

		const moved = sessionDetail(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 6,
			today: '2026-09-10'
		});
		expect(moved?.lesson?.title).toBe(lesson.title);
		expect(moved?.note).toBe('went badly — redo the practical');

		const blocked = sessionDetail(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			today: '2026-09-10'
		});
		expect(blocked?.lesson).toBeNull();
		expect(blocked?.note).toBeNull();
	});
});

describe('removing a Blocked Day', () => {
	test('re-derives every Class, undoing the shift-right', () => {
		const { db, course, classA, classB } = setUp();
		const topicA = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topicA.id, 6);
		const topicB = makeTopic(db, course.id, 'Waves');
		makeLessons(db, topicB.id, 4);

		assignTopic(db, { classId: classA.id, topicId: topicA.id, today: '2026-09-03' });
		assignTopic(db, { classId: classB.id, topicId: topicB.id, today: '2026-09-03' });
		const before = classSchedule(db, { classId: classA.id, today: '2026-09-03' });

		const blockedDate = '2026-09-14';
		blockDay(db, { date: blockedDate, note: 'Snow day', today: '2026-09-03' });

		const report = unblockDay(db, { date: blockedDate, today: '2026-09-03' });
		expect(report).toEqual({ placementsMoved: [] });

		const after = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		expect(after.scheduled).toEqual(before.scheduled);
		expect(
			db.select().from(schema.blockedDay).where(eq(schema.blockedDay.date, blockedDate)).all()
		).toHaveLength(0);
	});

	test('keeps the Teaching note with its Lesson when the re-derivation moves the Lesson back, and is a no-op for a date that is not blocked', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [lesson] = makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-01' });

		// Blocking 3 Sep, the first Available Slot of the Class, pushes the Lesson onto the next
		// Slot. The teacher notes it there.
		blockDay(db, { date: '2026-09-03', note: 'Snow day', today: '2026-09-01' });
		const pushed = classSchedule(db, { classId: classA.id, today: '2026-09-01' }).scheduled[0];
		writeTeachingNote(db, {
			classId: classA.id,
			date: pushed.date,
			period: pushed.period,
			note: 'went badly — redo the practical'
		});

		const report = unblockDay(db, { date: '2026-09-03', today: '2026-09-10' });
		expect(report).toEqual({ placementsMoved: [] });

		const taught = classSchedule(db, { classId: classA.id, today: '2026-09-10' }).history.find(
			(s) => s.lessonId === lesson.id
		)!;
		expect(taught.date).toBe('2026-09-03');
		const detail = sessionDetail(db, {
			classId: classA.id,
			date: taught.date,
			period: taught.period,
			today: '2026-09-10'
		});
		expect(detail?.note).toBe('went badly — redo the practical');

		expect(unblockDay(db, { date: '2026-09-10', today: '2026-09-10' })).toBeNull();
	});
});

describe('blocking a day: the refusals every door shares', () => {
	test('refuses a malformed date, a weekend date, and a date already blocked', () => {
		const { db } = setUp();

		refused(
			() => blockDay(db, { date: '2026-02-30', today: '2026-09-01' }),
			'invalid',
			'"2026-02-30" is not a real date.'
		);
		// 12 September 2026 is a Saturday.
		refused(
			() => blockDay(db, { date: '2026-09-12', today: '2026-09-01' }),
			'invalid',
			'"2026-09-12" falls on a weekend. A Blocked Day must be a Monday to Friday.'
		);
		expect(blockDay(db, { date: '2026-09-03', today: '2026-09-01' })).toEqual({
			placementsMoved: []
		});
		refused(
			() => blockDay(db, { date: '2026-09-03', today: '2026-09-01' }),
			'conflict',
			'"2026-09-03" is already a Blocked Day.'
		);
	});

	test('allows a date outside every Term, because a closure does not need a Term to be real', () => {
		const { db } = setUp();
		// 27 August 2026, a Thursday, before the first Term opens.
		const report = blockDay(db, { date: '2026-08-27', today: '2026-09-01' });
		expect(report).toEqual({ placementsMoved: [] });
	});
});

describe('removing a Blocked Slot', () => {
	test('re-derives the one Class, and is a no-op for an unknown id', () => {
		const { db, course, classA, classB } = setUp();
		const topicA = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topicA.id, 6);
		const topicB = makeTopic(db, course.id, 'Waves');
		makeLessons(db, topicB.id, 4);

		assignTopic(db, { classId: classA.id, topicId: topicA.id, today: '2026-09-03' });
		assignTopic(db, { classId: classB.id, topicId: topicB.id, today: '2026-09-03' });
		const before = classSchedule(db, { classId: classA.id, today: '2026-09-03' });

		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3)!;

		blockSlot(db, {
			classId: classA.id,
			date: '2026-09-14',
			slotId: mondaySlot.id,
			note: 'Field trip',
			today: '2026-09-03'
		});
		const [row] = db
			.select()
			.from(schema.blockedSlot)
			.where(eq(schema.blockedSlot.classId, classA.id))
			.all();

		unblockSlot(db, { id: row.id, today: '2026-09-03' });

		const after = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		expect(after.scheduled).toEqual(before.scheduled);
		expect(
			db.select().from(schema.blockedSlot).where(eq(schema.blockedSlot.id, row.id)).all()
		).toHaveLength(0);

		expect(unblockSlot(db, { id: 'does-not-exist', today: '2026-09-03' })).toBeNull();
	});
});
