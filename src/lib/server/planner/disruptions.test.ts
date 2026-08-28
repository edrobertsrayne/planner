import { and, eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, setUp } from './fixtures';
import {
	assignTopic,
	blockDay,
	blockSlot,
	classSchedule,
	sessionDetail,
	unblockDay,
	unblockSlot,
	writeSessionNote
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

	test('reports a noted Session that a Rewind relabels as atRisk rather than silently changing it', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 1);

		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		// Notes belong to the dated occasion (ADR-0002); writing one is out of this ticket's
		// scope, so the fixture pokes it in directly rather than going through a seam operation.
		db.update(schema.session)
			.set({ note: 'went badly — redo the practical' })
			.where(and(eq(schema.session.classId, classA.id), eq(schema.session.date, '2026-09-03')))
			.run();

		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 4 && s.period === 5)!;

		// The note was written on 3 Sep P5, but the trip was actually that same period — a Rewind
		// lands directly on the noted Session, entered after the fact.
		const report = blockSlot(db, {
			classId: classA.id,
			date: '2026-09-03',
			slotId: mondaySlot.id,
			note: 'Field trip',
			today: '2026-09-10'
		});

		expect(report.atRisk).toHaveLength(1);
		expect(report.atRisk[0]).toMatchObject({
			classId: classA.id,
			classLabel: classA.label,
			date: '2026-09-03',
			period: 5,
			lessonTitle: lessons[0].title
		});
	});

	test('keeps a noted Session on its occasion even when a Rewind drops it from the plan entirely', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 1);

		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		writeSessionNote(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			note: 'went badly — redo the practical'
		});

		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 4 && s.period === 5)!;

		// The same Rewind as above, onto the noted occasion's own Slot — its Lesson is rescheduled
		// elsewhere, so this occasion drops out of the plan entirely (it is neither still scheduled
		// nor open). The note is the one irreplaceable thing in the system (#38): it must stay
		// on (class_id, date, period) rather than being deleted along with the row that carried it.
		blockSlot(db, {
			classId: classA.id,
			date: '2026-09-03',
			slotId: mondaySlot.id,
			note: 'Field trip',
			today: '2026-09-10'
		});

		const detail = sessionDetail(db, { classId: classA.id, date: '2026-09-03', period: 5 });
		expect(detail?.note).toBe('went badly — redo the practical');
		expect(detail?.lesson).toBeNull();
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
		expect(report?.atRisk).toEqual([]);

		const after = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		expect(after.scheduled).toEqual(before.scheduled);
		expect(
			db.select().from(schema.blockedDay).where(eq(schema.blockedDay.date, blockedDate)).all()
		).toHaveLength(0);
	});

	test('reports a noted Session the re-derivation relabels back, and is a no-op for a date that is not blocked', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-01' });

		// Blocking 3 Sep — classA's first Available Slot — pushes the Lesson onto whatever comes
		// next; a note written there is what a Rewind onto the block's removal relabels.
		blockDay(db, { date: '2026-09-03', note: 'Snow day', today: '2026-09-01' });
		const pushed = classSchedule(db, { classId: classA.id, today: '2026-09-01' }).scheduled[0];
		writeSessionNote(db, {
			classId: classA.id,
			date: pushed.date,
			period: pushed.period,
			note: 'went badly — redo the practical'
		});

		const report = unblockDay(db, { date: '2026-09-03', today: '2026-09-10' });
		expect(report?.atRisk.length).toBeGreaterThan(0);

		expect(unblockDay(db, { date: '2026-09-10', today: '2026-09-10' })).toBeNull();
	});
});

describe('blocking a day: the refusals every door shares', () => {
	test('refuses a malformed date, a weekend date, and a date already blocked', () => {
		const { db } = setUp();

		expect(blockDay(db, { date: '2026-02-30', today: '2026-09-01' })).toEqual({
			ok: false,
			status: 400,
			reason: '"2026-02-30" is not a real date.'
		});
		// 12 September 2026 is a Saturday.
		expect(blockDay(db, { date: '2026-09-12', today: '2026-09-01' })).toEqual({
			ok: false,
			status: 400,
			reason: '"2026-09-12" falls on a weekend. A Blocked Day must be a Monday to Friday.'
		});
		expect(blockDay(db, { date: '2026-09-03', today: '2026-09-01' })).toMatchObject({ ok: true });
		expect(blockDay(db, { date: '2026-09-03', today: '2026-09-01' })).toEqual({
			ok: false,
			status: 409,
			reason: '"2026-09-03" is already a Blocked Day.'
		});
	});

	test('allows a date outside every Term, because a closure does not need a Term to be real', () => {
		const { db } = setUp();
		// 27 August 2026, a Thursday, before the first Term opens.
		const report = blockDay(db, { date: '2026-08-27', today: '2026-09-01' });
		expect(report).toMatchObject({ ok: true, atRisk: [] });
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
