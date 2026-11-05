import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, refused, setUp } from './fixtures';
import {
	agenda,
	assignTopic,
	blockDay,
	addSlot,
	blockSlots,
	calendarWeek,
	classSchedule,
	clearCover,
	coverChoices,
	createLink,
	deleteLesson,
	discardBlankCover,
	editLesson,
	endSlot,
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

describe('a new Cover left blank', () => {
	function newCover() {
		const fx = absentMonday();
		const { lesson, coverId } = setCover(fx.db, {
			classId: fx.classA.id,
			date: MON,
			slotId: fx.slotA,
			title: 'Cover: 9B/Sc1'
		});
		return { ...fx, lesson, coverId };
	}
	const lessons = (fx: ReturnType<typeof newCover>) =>
		fx.db.select().from(schema.lesson).where(eq(schema.lesson.id, fx.lesson.id)).all();

	test('is discarded with its Lesson when nothing was written', () => {
		const fx = newCover();

		expect(discardBlankCover(fx.db, { coverId: fx.coverId, dir: fx.atDir, today: TODAY })).toBe(
			true
		);

		expect(fx.db.select().from(schema.cover).all()).toEqual([]);
		expect(lessons(fx)).toEqual([]);
	});

	test('is kept once the plan has text', () => {
		const fx = newCover();
		editLesson(fx.db, { id: fx.lesson.id, change: { body: 'Read pages 40-52' }, today: TODAY });

		expect(discardBlankCover(fx.db, { coverId: fx.coverId, dir: fx.atDir, today: TODAY })).toBe(
			false
		);
		expect(lessons(fx)).toHaveLength(1);
		expect(fx.db.select().from(schema.cover).all()).toHaveLength(1);
	});

	test('is kept once the Lesson has a Link', () => {
		const fx = newCover();
		createLink(fx.db, { lessonId: fx.lesson.id, url: 'https://example.com', label: 'Reading' });

		expect(discardBlankCover(fx.db, { coverId: fx.coverId, dir: fx.atDir, today: TODAY })).toBe(
			false
		);
	});

	test('a Cover already cleared is nothing to discard', () => {
		const fx = newCover();
		clearCover(fx.db, { id: fx.coverId });

		expect(discardBlankCover(fx.db, { coverId: fx.coverId, dir: fx.atDir, today: TODAY })).toBe(
			false
		);
	});
});

describe('Cover choices', () => {
	test('are the Standalone Lessons, never a Topic Lesson', () => {
		const { db, course } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 2);
		db.insert(schema.lesson).values({ topicId: null, title: 'Silent reading', position: 0 }).run();

		expect(coverChoices(db).map((l) => l.title)).toEqual(['Silent reading']);
	});
});

describe('Cover keeps to the Absence it was set for', () => {
	// Mon 14 Sep is both an absent Blocked Slot (9B's P3) and a closed Blocked Day.
	function absentSlotOnClosedDay() {
		const fx = setUp();
		blockSlots(fx.db, {
			classId: fx.classA.id,
			date: MON,
			slotIds: [slotOf(fx)],
			note: 'Meeting',
			absent: true,
			today: TODAY
		});
		blockDay(fx.db, { date: MON, note: 'Snow', today: TODAY });
		setCover(fx.db, { classId: fx.classA.id, date: MON, slotId: slotOf(fx), title: 'C' });
		return fx;
	}
	const slotOf = (fx: ReturnType<typeof setUp>) =>
		fx.db
			.select()
			.from(schema.slot)
			.where(eq(schema.slot.classId, fx.classA.id))
			.all()
			.find((s) => s.week === 'A' && s.day === 1)!.id;

	test('unblocking a closure leaves the Cover of an Absence that is still there', () => {
		const fx = absentSlotOnClosedDay();

		unblockDay(fx.db, { date: MON, today: TODAY });

		expect(fx.db.select().from(schema.cover).all()).toHaveLength(1);
	});

	test('unblocking a plain Blocked Slot leaves the Cover of an absent day', () => {
		const fx = absentMonday();
		blockSlots(fx.db, {
			classId: fx.classA.id,
			date: MON,
			slotIds: [fx.slotA],
			note: 'Meeting',
			today: TODAY
		});
		setCover(fx.db, { classId: fx.classA.id, date: MON, slotId: fx.slotA, title: 'C' });
		const [plain] = fx.db.select().from(schema.blockedSlot).all();

		unblockSlot(fx.db, { id: plain.id, today: TODAY });

		expect(fx.db.select().from(schema.cover).all()).toHaveLength(1);
	});

	test('ending the Slot ends its Cover, so the Lesson can be deleted again', () => {
		const fx = absentMonday();
		const { lesson } = setCover(fx.db, {
			classId: fx.classA.id,
			date: MON,
			slotId: fx.slotA,
			title: 'C'
		});

		endSlot(fx.db, { id: fx.slotA, from: '2026-09-10', today: TODAY });

		expect(fx.db.select().from(schema.cover).all()).toEqual([]);
		expect(() => deleteLesson(fx.db, { id: lesson.id, today: TODAY, dir: fx.atDir })).not.toThrow();
	});

	test('a Slot that never held before the end date goes without a foreign-key fault', () => {
		const fx = setUp();
		const added = addSlot(fx.db, {
			classId: fx.classA.id,
			week: 'B',
			day: 3,
			period: 2,
			holdsFrom: '2026-09-16'
		});
		blockDay(fx.db, { date: '2026-09-23', note: 'Ill', absent: true, today: TODAY });
		setCover(fx.db, { classId: fx.classA.id, date: '2026-09-23', slotId: added.id, title: 'C' });

		expect(() => endSlot(fx.db, { id: added.id, from: '2026-09-16', today: TODAY })).not.toThrow();
		expect(fx.db.select().from(schema.cover).all()).toEqual([]);
	});

	test('only a Standalone Lesson can be a Cover', () => {
		const fx = absentMonday();
		const topic = makeTopic(fx.db, fx.course.id, 'Waves');
		const [inTopic] = makeLessons(fx.db, topic.id, 1);

		refused(
			() =>
				setCover(fx.db, {
					classId: fx.classA.id,
					date: MON,
					slotId: fx.slotA,
					lessonId: inTopic.id
				}),
			'invalid',
			'Only a Standalone Lesson can be a Cover.'
		);
	});
});
