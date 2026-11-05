import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, refused, setUp } from './fixtures';
import {
	agenda,
	assignTopic,
	blockDay,
	blockSlots,
	calendarWeek,
	classSchedule,
	clearCover,
	deleteLesson,
	planningStream,
	setCover,
	unblockDay,
	unblockSlot
} from './index';
import * as schema from '../db/schema';

// Mon 14 Sep 2026 is a Week A Monday: 9B/Sc1 is taught P3 and 10C/Ph2 P1. Wed 16 Sep is 9B P1.
const MON = '2026-09-14';
const TODAY = '2026-09-03';

function absentMonday() {
	const fx = setUp();
	const topic = makeTopic(fx.db, fx.course.id, 'Forces');
	makeLessons(fx.db, topic.id, 6);
	assignTopic(fx.db, { classId: fx.classA.id, topicId: topic.id, today: TODAY });
	blockDay(fx.db, { date: MON, note: 'Ill', absent: true, today: TODAY });

	const slotOf = (classId: string) =>
		fx.db
			.select()
			.from(schema.slot)
			.where(eq(schema.slot.classId, classId))
			.all()
			.find((s) => s.week === 'A' && s.day === 1)!.id;
	return { ...fx, slotA: slotOf(fx.classA.id), slotB: slotOf(fx.classB.id) };
}

describe('Absence', () => {
	test('shifts Lessons right exactly as a closure does', () => {
		const closed = setUp();
		const absent = setUp();
		for (const fx of [closed, absent]) {
			const topic = makeTopic(fx.db, fx.course.id, 'Forces');
			makeLessons(fx.db, topic.id, 6);
			assignTopic(fx.db, { classId: fx.classA.id, topicId: topic.id, today: TODAY });
		}
		blockDay(closed.db, { date: MON, note: 'INSET', today: TODAY });
		blockDay(absent.db, { date: MON, note: 'Ill', absent: true, today: TODAY });

		const dates = (fx: typeof closed) =>
			classSchedule(fx.db, { classId: fx.classA.id, today: TODAY }).scheduled.map((s) => s.date);
		expect(dates(absent)).toEqual(dates(closed));
	});

	test('an absent Blocked Day lists every Class and Period it takes in the Agenda', () => {
		const { db, classA, classB } = absentMonday();
		const day = agenda(db, { today: TODAY, horizonDays: 14 }).blockedDays.find(
			(d) => d.date === MON
		)!;

		expect(day.absent).toBe(true);
		expect(day.lines.map((l) => [l.classLabel, l.period, l.cover])).toEqual([
			[classB.label, 1, null],
			[classA.label, 3, null]
		]);
	});

	test('a closure lists no lines and is not absent', () => {
		const { db } = setUp();
		blockDay(db, { date: MON, note: 'INSET', today: TODAY });
		const day = agenda(db, { today: TODAY, horizonDays: 14 }).blockedDays.find(
			(d) => d.date === MON
		)!;

		expect(day.absent).toBe(false);
		expect(day.lines).toEqual([]);
	});

	test('an absent Blocked Slot is a row marked absent; a plain one is not', () => {
		const { db, classA, slotA } = absentMonday();
		unblockDay(db, { date: MON, today: TODAY });
		blockSlots(db, {
			classId: classA.id,
			date: MON,
			slotIds: [slotA],
			note: 'Appointment',
			absent: true,
			today: TODAY
		});
		const row = agenda(db, { today: TODAY, horizonDays: 14 }).rows.find((r) => r.blocked)!;

		expect(row.blocked).toMatchObject({ note: 'Appointment', absent: true, cover: null });
	});

	test('the Calendar marks absent cells and days', () => {
		const { db, classA } = absentMonday();
		const week = calendarWeek(db, { weekCommencing: MON, today: TODAY })!;
		const cell = week.cells.find((c) => c.classId === classA.id && c.date === MON)!;

		expect(cell).toMatchObject({ kind: 'blocked', absent: true, cover: null });
		expect(week.blockedDays[0].absent).toBe(true);
	});
});

describe('Cover', () => {
	test('is a new Standalone Lesson on the absent Slot, read back by the Agenda and the Calendar', () => {
		const { db, classA, slotA } = absentMonday();
		const { lesson } = setCover(db, {
			classId: classA.id,
			date: MON,
			slotId: slotA,
			title: 'Cover: 9B/Sc1'
		});

		expect(lesson).toMatchObject({ topicId: null, title: 'Cover: 9B/Sc1' });
		const line = agenda(db, { today: TODAY, horizonDays: 14 })
			.blockedDays.find((d) => d.date === MON)!
			.lines.find((l) => l.classId === classA.id)!;
		expect(line.cover).toMatchObject({ lessonId: lesson.id, title: 'Cover: 9B/Sc1' });
		const cell = calendarWeek(db, { weekCommencing: MON, today: TODAY })!.cells.find(
			(c) => c.classId === classA.id && c.date === MON
		)!;
		expect(cell).toMatchObject({ kind: 'blocked', cover: { lessonId: lesson.id } });
	});

	test('may be an existing Lesson, shared by two Classes', () => {
		const { db, classA, classB, slotA, slotB } = absentMonday();
		const { lesson } = setCover(db, {
			classId: classA.id,
			date: MON,
			slotId: slotA,
			title: 'Silent reading'
		});
		setCover(db, { classId: classB.id, date: MON, slotId: slotB, lessonId: lesson.id });

		const lines = agenda(db, { today: TODAY, horizonDays: 14 }).blockedDays.find(
			(d) => d.date === MON
		)!.lines;
		expect(lines.map((l) => l.cover?.lessonId)).toEqual([lesson.id, lesson.id]);
	});

	test('moves nothing: the Sequence is laid out as it was without it', () => {
		const { db, classA, slotA } = absentMonday();
		const before = classSchedule(db, { classId: classA.id, today: TODAY });
		setCover(db, { classId: classA.id, date: MON, slotId: slotA, title: 'Cover' });

		expect(classSchedule(db, { classId: classA.id, today: TODAY })).toEqual(before);
	});

	test('may be recorded for a past date', () => {
		const { db, classA, slotA } = absentMonday();
		expect(() =>
			setCover(db, { classId: classA.id, date: MON, slotId: slotA, title: 'Logged afterwards' })
		).not.toThrow();
	});

	test('is refused on a Slot no Absence removes', () => {
		const { db, classA, slotA } = absentMonday();
		unblockDay(db, { date: MON, today: TODAY });
		blockDay(db, { date: MON, note: 'INSET', today: TODAY });

		refused(
			() => setCover(db, { classId: classA.id, date: MON, slotId: slotA, title: 'Cover' }),
			'invalid',
			`${MON} is not an Absence for that Slot.`
		);
	});

	test('is refused twice on one Slot', () => {
		const { db, classA, slotA } = absentMonday();
		setCover(db, { classId: classA.id, date: MON, slotId: slotA, title: 'Cover' });

		refused(
			() => setCover(db, { classId: classA.id, date: MON, slotId: slotA, title: 'Again' }),
			'conflict',
			'That Slot already has a Cover.'
		);
	});

	test('needs a title when it makes a new Lesson', () => {
		const { db, classA, slotA } = absentMonday();
		refused(
			() => setCover(db, { classId: classA.id, date: MON, slotId: slotA, title: '  ' }),
			'invalid',
			'A Lesson needs a title.'
		);
	});

	test('clearing leaves the Lesson standing', () => {
		const { db, classA, slotA } = absentMonday();
		const { lesson } = setCover(db, { classId: classA.id, date: MON, slotId: slotA, title: 'C' });
		const line = () =>
			agenda(db, { today: TODAY, horizonDays: 14 })
				.blockedDays.find((d) => d.date === MON)!
				.lines.find((l) => l.classId === classA.id)!;

		clearCover(db, { id: line().cover!.id });

		expect(line().cover).toBeNull();
		expect(
			db.select().from(schema.lesson).where(eq(schema.lesson.id, lesson.id)).all()
		).toHaveLength(1);
	});

	test('ends with its Absence, leaving the Lesson', () => {
		const { db, classA, slotA } = absentMonday();
		const { lesson } = setCover(db, { classId: classA.id, date: MON, slotId: slotA, title: 'C' });

		unblockDay(db, { date: MON, today: TODAY });

		expect(db.select().from(schema.cover).all()).toEqual([]);
		expect(
			db.select().from(schema.lesson).where(eq(schema.lesson.id, lesson.id)).all()
		).toHaveLength(1);
	});

	test('ends when its absent Blocked Slot is unblocked', () => {
		const { db, classA, slotA } = absentMonday();
		unblockDay(db, { date: MON, today: TODAY });
		blockSlots(db, {
			classId: classA.id,
			date: MON,
			slotIds: [slotA],
			note: 'Meeting',
			absent: true,
			today: TODAY
		});
		setCover(db, { classId: classA.id, date: MON, slotId: slotA, title: 'C' });
		const blocked = db.select().from(schema.blockedSlot).all()[0];

		unblockSlot(db, { id: blocked.id, today: TODAY });

		expect(db.select().from(schema.cover).all()).toEqual([]);
	});

	test('keeps its Lesson from being deleted', () => {
		const { db, classA, slotA, atDir } = absentMonday();
		const { lesson } = setCover(db, { classId: classA.id, date: MON, slotId: slotA, title: 'C' });

		refused(
			() => deleteLesson(db, { id: lesson.id, today: TODAY, dir: atDir }),
			'conflict',
			'A Cover names this Lesson, so it cannot be removed. Remove the Cover first.'
		);
	});

	test('is kept out of Planning', () => {
		const { db, classA, slotA } = absentMonday();
		setCover(db, { classId: classA.id, date: MON, slotId: slotA, title: 'Cover: 9B/Sc1' });

		expect(planningStream(db, TODAY).map((e) => e.title)).not.toContain('Cover: 9B/Sc1');
	});
});
