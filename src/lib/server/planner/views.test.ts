import { and, eq, sql } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, setUp } from './fixtures';
import {
	addSlot,
	agenda,
	assignedTopicsOf,
	assignTopic,
	blockDay,
	blockSlot,
	calendarWeek,
	classSchedule,
	deleteLesson,
	listClasses,
	moveLessonToTopic,
	planningStream,
	recordContinuation,
	sessionDetail,
	setLessonStatus,
	setReadiness,
	teachingWeeks,
	unassignTopic,
	unblockDay
} from './index';
import * as schema from '../db/schema';

describe('the Agenda', () => {
	// 2026-09-03 is a Thursday, the day Term 1 opens. classA's first Available Slot is that
	// Thursday's double (P5, P6); classB's is the following Monday (2026-09-07) P1.
	test('runs chronologically across every Class, and a Lesson with Length > 1 is one row', () => {
		const { db, course, classA, classB } = setUp();
		const forces = makeTopic(db, course.id, 'Forces');
		const [wideLesson] = makeLessons(db, forces.id, 1, 2);
		assignTopic(db, { classId: classA.id, topicId: forces.id, today: '2026-09-03' });

		const optics = makeTopic(db, course.id, 'Optics');
		makeLessons(db, optics.id, 1);
		assignTopic(db, { classId: classB.id, topicId: optics.id, today: '2026-09-03' });

		const rows = agenda(db, { today: '2026-09-03', horizonDays: 14 });

		expect(rows[0]).toMatchObject({
			classId: classA.id,
			classLabel: '9B/Sc1',
			date: '2026-09-03',
			periodFrom: 5,
			periodTo: 6,
			lesson: { title: wideLesson.title, topicName: 'Forces' }
		});
		// classB's Slot is Week A Mon P1 and Week B Wed P4; the Thursday Term opens on is Week A,
		// so classB's first Available Slot is the following Week B Wednesday, 2026-09-09.
		const dates = rows.map((r) => r.date);
		expect(dates).toEqual([...dates].sort());
		expect(rows.some((r) => r.classId === classB.id && r.date === '2026-09-09')).toBe(true);
	});

	test('the horizon is calendar days: weekends inside it produce no row, and it can be narrowed to today', () => {
		const { db, course, classA } = setUp();
		const forces = makeTopic(db, course.id, 'Forces');
		makeLessons(db, forces.id, 10);
		assignTopic(db, { classId: classA.id, topicId: forces.id, today: '2026-09-03' });

		// 2026-09-05/06 is the Sat/Sun immediately after Term opens.
		const week = agenda(db, { today: '2026-09-03', horizonDays: 7 });
		expect(week.some((r) => r.date === '2026-09-05' || r.date === '2026-09-06')).toBe(false);

		const today = agenda(db, { today: '2026-09-03', horizonDays: 1 });
		expect(today.every((r) => r.date === '2026-09-03')).toBe(true);
		expect(today.length).toBeGreaterThan(0);
	});

	test('an Open Slot appears as an ordinary row carrying no Lesson', () => {
		const { db, classA } = setUp();
		// No Topic assigned at all: every Available Slot is open.

		const rows = agenda(db, { today: '2026-09-03', horizonDays: 1 });

		expect(rows.length).toBeGreaterThan(0);
		expect(rows.every((r) => r.classId === classA.id && r.lesson === null)).toBe(true);
	});

	test('every row carries its Class Tone (issue #87)', () => {
		const { db, course, classA, classB } = setUp();
		const forces = makeTopic(db, course.id, 'Forces');
		makeLessons(db, forces.id, 3);
		assignTopic(db, { classId: classA.id, topicId: forces.id, today: '2026-09-03' });

		const optics = makeTopic(db, course.id, 'Optics');
		makeLessons(db, optics.id, 3);
		assignTopic(db, { classId: classB.id, topicId: optics.id, today: '2026-09-03' });

		const tones = new Map(listClasses(db).map((c) => [c.id, c.tone]));

		const rows = agenda(db, { today: '2026-09-03', horizonDays: 14 });
		expect(rows.length).toBeGreaterThan(0);
		expect(new Set(rows.map((r) => r.classId))).toEqual(new Set([classA.id, classB.id]));
		for (const row of rows) expect(row.tone).toBe(tones.get(row.classId));
	});
});

describe('the Calendar', () => {
	// The first Teaching Week (issue #28's fixture) has weekCommencing 2026-08-31, a Monday two
	// days before Term 1 opens Thursday 3 Sep — so Mon/Tue/Wed that week fall outside every Term
	// even though it is a Teaching Week overall. classA's Slots that week are Mon P3, Wed P1, and
	// the Thu P5/P6 double; classB's is Mon P1. Thu is the only in-term day either Class holds.
	test('shows a Lesson, an Open Slot, a Slot outside the Term, and a genuinely free position', () => {
		const { db, course, classA, classB } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [lesson] = makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const week = calendarWeek(db, { weekCommencing: '2026-08-31', today: '2026-09-03' });

		expect(week?.letter).toBe('A');
		expect(week?.days.map((d) => d.date)).toEqual([
			'2026-08-31',
			'2026-09-01',
			'2026-09-02',
			'2026-09-03',
			'2026-09-04'
		]);

		const at = (date: string, period: number, classId: string) =>
			week?.cells.find((c) => c.date === date && c.periodFrom === period && c.classId === classId);

		// Thursday, in term: the Lesson lands on P5, and P6 — still an Available Slot, just
		// nothing left to teach — is open, not blocked.
		expect(at('2026-09-03', 5, classA.id)).toMatchObject({
			kind: 'lesson',
			lesson: { title: lesson.title, topicName: 'Forces' }
		});
		expect(at('2026-09-03', 6, classA.id)).toMatchObject({ kind: 'open', lesson: null });

		// Monday and Wednesday are outside every Term, even though the Timetable puts each Class
		// there — blocked, the same as a Blocked Day, and never mistaken for an Open Slot.
		expect(at('2026-08-31', 3, classA.id)).toMatchObject({ kind: 'blocked' });
		expect(at('2026-08-31', 1, classB.id)).toMatchObject({ kind: 'blocked' });
		expect(at('2026-09-02', 1, classA.id)).toMatchObject({ kind: 'blocked' });

		// Friday: neither Class holds a Slot there in Week A at all — genuinely free, not blocked.
		expect(week?.cells.some((c) => c.date === '2026-09-04')).toBe(false);
	});

	test('a Lesson with Length > 1 is one cell spanning its Periods, not two', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [wideLesson] = makeLessons(db, topic.id, 1, 2);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const week = calendarWeek(db, { weekCommencing: '2026-08-31', today: '2026-09-03' });

		const cells = week?.cells.filter((c) => c.classId === classA.id && c.date === '2026-09-03');
		expect(cells).toHaveLength(1);
		expect(cells?.[0]).toMatchObject({
			periodFrom: 5,
			periodTo: 6,
			kind: 'lesson',
			lesson: { title: wideLesson.title }
		});
	});

	test('a Blocked Slot drains the colour and carries its note, distinct from an Open Slot', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 2);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const thuP5 = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 4 && s.period === 5)!;

		const thuP6 = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 4 && s.period === 6)!;

		blockSlot(db, {
			classId: classA.id,
			date: '2026-09-03',
			slotId: thuP5.id,
			note: 'Field trip',
			today: '2026-09-03'
		});

		const week = calendarWeek(db, { weekCommencing: '2026-08-31', today: '2026-09-03' });
		const at = (period: number) =>
			week?.cells.find(
				(c) => c.date === '2026-09-03' && c.periodFrom === period && c.classId === classA.id
			);
		const blocked = at(5);
		expect(blocked).toMatchObject({ kind: 'blocked', blockedNote: 'Field trip', lesson: null });
		expect(blocked?.blockedSlotId).toBeTruthy();
		expect(blocked?.blockedDayId).toBeNull();

		// Shift-right moved the first Lesson into the Slot the block left free.
		const shifted = at(6);
		expect(shifted).toMatchObject({ kind: 'lesson' });
		expect(shifted?.slotIds).toEqual([thuP6.id]);
		expect(shifted?.blockedSlotId).toBeNull();
	});

	test('a Blocked Day is reported for its date, for the Calendar to offer removing it', () => {
		const { db } = setUp();
		blockDay(db, { date: '2026-09-03', note: 'Snow day', today: '2026-09-01' });

		const week = calendarWeek(db, { weekCommencing: '2026-08-31', today: '2026-09-01' });

		expect(week?.blockedDays).toEqual([
			{ id: expect.any(String), date: '2026-09-03', note: 'Snow day' }
		]);
		const blocked = week?.cells.find((c) => c.date === '2026-09-03');
		expect(blocked?.blockedDayId).toBe(week?.blockedDays[0].id);
	});

	test('every date carries a day kind — teaching, blocked, or holiday — and a holiday wins over a Blocked Day', () => {
		const { db } = setUp();
		// Mon 2026-08-31 to Wed 2026-09-02 sit outside every Term; Thu 09-03 and Fri 09-04 are in
		// Term 1. A Blocked Day in term is blocked; a Blocked Day out of term stays a holiday.
		blockDay(db, { date: '2026-09-04', note: 'INSET', today: '2026-09-01' });
		blockDay(db, { date: '2026-08-31', today: '2026-09-01' });

		const week = calendarWeek(db, { weekCommencing: '2026-08-31', today: '2026-09-01' });

		expect(week?.days).toEqual([
			{ date: '2026-08-31', kind: 'holiday' },
			{ date: '2026-09-01', kind: 'holiday' },
			{ date: '2026-09-02', kind: 'holiday' },
			{ date: '2026-09-03', kind: 'teaching' },
			{ date: '2026-09-04', kind: 'blocked' }
		]);
	});

	test('a Blocked Slot recorded outside every Term keeps its record under a holiday day kind', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		// Monday 2026-08-31 sits outside every Term. A Blocked Slot entered there — or stranded
		// there by a later Term change — is still attributed, so the grid can offer its unblock
		// even though the column reads as a School Holiday.
		const monP3 = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3)!;
		blockSlot(db, {
			classId: classA.id,
			date: '2026-08-31',
			slotId: monP3.id,
			note: 'Trip',
			today: '2026-09-01'
		});

		const week = calendarWeek(db, { weekCommencing: '2026-08-31', today: '2026-09-01' });
		expect(week?.days.find((d) => d.date === '2026-08-31')?.kind).toBe('holiday');
		const cell = week?.cells.find((c) => c.date === '2026-08-31' && c.periodFrom === 3);
		expect(cell).toMatchObject({ kind: 'blocked', blockedNote: 'Trip' });
		expect(cell?.blockedSlotId).toBeTruthy();
		expect(cell?.blockedDayId).toBeNull();
	});

	test('a Term change re-letters the year, and the schedule follows the computed letter', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [lesson] = makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		const before = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		expect(before.scheduled[0]).toMatchObject({
			lessonId: lesson.id,
			date: '2026-09-03',
			period: 5
		});

		expect(teachingWeeks(db).find((w) => w.weekCommencing === '2026-08-31')?.letter).toBe('A');

		// Autumn 1 opening a week earlier adds one Teaching Week before it, so that week and
		// every week after it re-letter: w/c 31 August becomes Week B.
		db.update(schema.term)
			.set({ opens: '2026-08-27' })
			.where(eq(schema.term.opens, '2026-09-03'))
			.run();
		expect(teachingWeeks(db).find((w) => w.weekCommencing === '2026-08-31')?.letter).toBe('B');

		// As Week B, classA no longer holds a Thursday Slot that week (its Week B day 4
		// is bare) but does hold Friday P4 — so the Lesson moves there instead.
		const after = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		expect(after.scheduled.some((s) => s.date === '2026-09-03')).toBe(false);
		expect(after.scheduled[0]).toMatchObject({
			lessonId: lesson.id,
			date: '2026-09-04',
			period: 4
		});
	});
});

describe('the Planning stream', () => {
	test('ordered by soonest next Scheduled occurrence', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [l1, l2, l3] = makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const stream = planningStream(db, '2026-09-03');
		expect(stream.map((s) => s.id)).toEqual([l1.id, l2.id, l3.id]);
		expect(stream[0]).toMatchObject({
			id: l1.id,
			title: 'Lesson 1',
			topicName: 'Forces',
			courseName: 'Year 9 Science',
			status: 'draft',
			occurrence: {
				classId: classA.id,
				label: '9B/Sc1',
				tone: classA.tone,
				date: '2026-09-03',
				period: 5
			}
		});
	});

	test('a Lesson taught by two Classes takes the sooner of the two', () => {
		const { db, course, classA, classB } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [l1] = makeLessons(db, topic.id, 1);
		// classA's first slot is 2026-09-03 P5 (Thu)
		// classB's first slot is 2026-09-07 P1 (Mon)
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		assignTopic(db, { classId: classB.id, topicId: topic.id, today: '2026-09-03' });

		const stream = planningStream(db, '2026-09-03');
		const entry = stream.find((s) => s.id === l1.id);
		expect(entry?.occurrence).toMatchObject({
			classId: classA.id,
			label: '9B/Sc1',
			date: '2026-09-03',
			period: 5
		});
	});

	test('a Lesson with no scheduled occurrence sits at the bottom', () => {
		const { db, course, classA } = setUp();
		const topic1 = makeTopic(db, course.id, 'Forces');
		const topic2 = makeTopic(db, course.id, 'Electricity');
		const [l1, l2] = makeLessons(db, topic1.id, 2);
		const [u1, u2] = makeLessons(db, topic2.id, 2);

		// Only topic1 is assigned to classA
		assignTopic(db, { classId: classA.id, topicId: topic1.id, today: '2026-09-03' });

		const stream = planningStream(db, '2026-09-03');
		expect(stream.map((s) => s.id)).toEqual([l1.id, l2.id, u1.id, u2.id]);
		expect(stream[2].occurrence).toBeNull();
		expect(stream[3].occurrence).toBeNull();
	});

	test('a Blocked Day moves a row up the stream because the schedule re-derived beneath it', () => {
		const { db, course, classA, classB } = setUp();
		// classB teaches on Friday P2 in Week A
		addSlot(db, { classId: classB.id, week: 'A', day: 5, period: 2 });

		const topicA = makeTopic(db, course.id, 'Forces');
		const topicB = makeTopic(db, course.id, 'Chemistry');
		const [la] = makeLessons(db, topicA.id, 1);
		const [lb] = makeLessons(db, topicB.id, 1);

		// classA (9B/Sc1) teaches la on Thu 2026-09-03 P5
		assignTopic(db, { classId: classA.id, topicId: topicA.id, today: '2026-09-03' });
		// classB (10C/Ph2) teaches lb on Fri 2026-09-04 P2
		assignTopic(db, { classId: classB.id, topicId: topicB.id, today: '2026-09-03' });

		let stream = planningStream(db, '2026-09-03');
		expect(stream[0].id).toBe(la.id); // la is on 2026-09-03
		expect(stream[0].occurrence).toMatchObject({ date: '2026-09-03', period: 5 });
		expect(stream[1].id).toBe(lb.id); // lb is on 2026-09-04
		expect(stream[1].occurrence).toMatchObject({ date: '2026-09-04', period: 2 });

		// Block 2026-09-03: classA's first available slot shifts to Tue 2026-09-08 P2.
		// classB still teaches lb on Fri 2026-09-04 P2, so lb moves up to the top of the stream.
		blockDay(db, { date: '2026-09-03', today: '2026-09-03' });

		stream = planningStream(db, '2026-09-03');
		expect(stream[0].id).toBe(lb.id);
		expect(stream[0].occurrence).toMatchObject({ date: '2026-09-04', period: 2 });
		expect(stream[1].id).toBe(la.id);
		expect(stream[1].occurrence).toMatchObject({ date: '2026-09-08', period: 2 });
	});
});

describe('Readiness', () => {
	test('a mark is made and cleared, and operations are idempotent', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [l1] = makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		let rows = agenda(db, { today: '2026-09-03', horizonDays: 7 });
		expect(rows[0].lesson?.ready).toBe(false);

		setReadiness(db, l1.id, classA.id, true);
		rows = agenda(db, { today: '2026-09-03', horizonDays: 7 });
		expect(rows[0].lesson?.ready).toBe(true);

		// Idempotent: setting true again does not throw or duplicate
		expect(() => setReadiness(db, l1.id, classA.id, true)).not.toThrow();
		rows = agenda(db, { today: '2026-09-03', horizonDays: 7 });
		expect(rows[0].lesson?.ready).toBe(true);

		setReadiness(db, l1.id, classA.id, false);
		rows = agenda(db, { today: '2026-09-03', horizonDays: 7 });
		expect(rows[0].lesson?.ready).toBe(false);

		// Idempotent: setting false again does not throw
		expect(() => setReadiness(db, l1.id, classA.id, false)).not.toThrow();
		rows = agenda(db, { today: '2026-09-03', horizonDays: 7 });
		expect(rows[0].lesson?.ready).toBe(false);
	});

	test('two Classes taught one Lesson hold independent marks', () => {
		const { db, course, classA, classB } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [l1] = makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		assignTopic(db, { classId: classB.id, topicId: topic.id, today: '2026-09-03' });

		setReadiness(db, l1.id, classA.id, true);

		let rows = agenda(db, { today: '2026-09-03', horizonDays: 14 });
		const rowA = rows.find((r) => r.classId === classA.id && r.lesson?.id === l1.id);
		const rowB = rows.find((r) => r.classId === classB.id && r.lesson?.id === l1.id);

		expect(rowA?.lesson?.ready).toBe(true);
		expect(rowB?.lesson?.ready).toBe(false);

		setReadiness(db, l1.id, classB.id, true);
		rows = agenda(db, { today: '2026-09-03', horizonDays: 14 });
		expect(rows.find((r) => r.classId === classA.id)?.lesson?.ready).toBe(true);
		expect(rows.find((r) => r.classId === classB.id)?.lesson?.ready).toBe(true);

		setReadiness(db, l1.id, classA.id, false);
		rows = agenda(db, { today: '2026-09-03', horizonDays: 14 });
		expect(rows.find((r) => r.classId === classA.id)?.lesson?.ready).toBe(false);
		expect(rows.find((r) => r.classId === classB.id)?.lesson?.ready).toBe(true);
	});

	test('a Draft Lesson can be marked Ready, and marking the Lesson Draft leaves the mark', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [l1] = makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		expect(l1.status).toBe('draft');
		setReadiness(db, l1.id, classA.id, true);

		let rows = agenda(db, { today: '2026-09-03', horizonDays: 7 });
		expect(rows[0].lesson?.ready).toBe(true);

		setLessonStatus(db, l1.id, 'planned');
		rows = agenda(db, { today: '2026-09-03', horizonDays: 7 });
		expect(rows[0].lesson?.ready).toBe(true);

		setLessonStatus(db, l1.id, 'draft');
		rows = agenda(db, { today: '2026-09-03', horizonDays: 7 });
		expect(rows[0].lesson?.ready).toBe(true);
	});

	test('a mark survives a Blocked Day and a Rewind', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [l1] = makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		setReadiness(db, l1.id, classA.id, true);

		// Block 2026-09-03 (Shift-right moves l1 to 2026-09-08)
		const blockedDate = '2026-09-03';
		blockDay(db, { date: blockedDate, today: '2026-09-03' });

		let rows = agenda(db, { today: '2026-09-03', horizonDays: 14 });
		let rowA = rows.find((r) => r.classId === classA.id && r.lesson?.id === l1.id);
		expect(rowA?.date).toBe('2026-09-08');
		expect(rowA?.lesson?.ready).toBe(true);

		// Unblock (Rewind restores l1 to 2026-09-03)
		unblockDay(db, { date: blockedDate, today: '2026-09-03' });

		rows = agenda(db, { today: '2026-09-03', horizonDays: 14 });
		rowA = rows.find((r) => r.classId === classA.id && r.lesson?.id === l1.id);
		expect(rowA?.date).toBe('2026-09-03');
		expect(rowA?.lesson?.ready).toBe(true);
	});
});

describe('the Agenda carries the tick', () => {
	test('a row carrying a Lesson reports its mark, and an Open Slot row reports none', () => {
		const { db, course, classA, classB } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [l1] = makeLessons(db, topic.id, 1);
		// classA has an assigned topic with a lesson
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		// classB has no assigned topic (all open slots)

		const rows = agenda(db, { today: '2026-09-03', horizonDays: 7 });
		const rowA = rows.find((r) => r.classId === classA.id);
		const rowB = rows.find((r) => r.classId === classB.id);

		expect(rowA?.lesson).toEqual({
			id: l1.id,
			title: l1.title,
			topicName: 'Forces',
			ready: false
		});
		expect(rowB?.lesson).toBeNull();

		setReadiness(db, l1.id, classA.id, true);
		const updatedRows = agenda(db, { today: '2026-09-03', horizonDays: 7 });
		const updatedRowA = updatedRows.find((r) => r.classId === classA.id);
		expect(updatedRowA?.lesson?.ready).toBe(true);
	});

	test("a Continuation's two rows report the same mark, and one write moves both", () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [l1] = makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		// Record a continuation for classA on 2026-09-03 P5, when today is 2026-09-04
		recordContinuation(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			today: '2026-09-04'
		});

		// Now from 2026-09-03 with horizon 14, both 2026-09-03 and the continuation slot carry l1
		// Wait: on 2026-09-04, classA's slots carry the continuation
		// Let's check agenda from 2026-09-04:
		// classA has a continuation row carrying l1
		// If we add another slot or topic with another occurrence, or check readiness:
		setReadiness(db, l1.id, classA.id, true);

		const rows = agenda(db, { today: '2026-09-04', horizonDays: 14 });
		const l1Rows = rows.filter((r) => r.classId === classA.id && r.lesson?.id === l1.id);
		expect(l1Rows.length).toBeGreaterThan(0);
		for (const r of l1Rows) {
			expect(r.lesson?.ready).toBe(true);
		}

		setReadiness(db, l1.id, classA.id, false);
		const clearedRows = agenda(db, { today: '2026-09-04', horizonDays: 14 });
		const clearedL1Rows = clearedRows.filter(
			(r) => r.classId === classA.id && r.lesson?.id === l1.id
		);
		for (const r of clearedL1Rows) {
			expect(r.lesson?.ready).toBe(false);
		}
	});
});

describe('Readiness dies with its pairing', () => {
	test("unassignTopic clears that Class's marks across the Topic and no other Class's", () => {
		const { db, course, classA, classB } = setUp();
		const topic1 = makeTopic(db, course.id, 'Forces');
		const [l1, l2] = makeLessons(db, topic1.id, 2);
		const topic2 = makeTopic(db, course.id, 'Energy');
		const [l3] = makeLessons(db, topic2.id, 1);

		assignTopic(db, { classId: classA.id, topicId: topic1.id, today: '2026-09-03' });
		assignTopic(db, { classId: classA.id, topicId: topic2.id, today: '2026-09-03' });
		assignTopic(db, { classId: classB.id, topicId: topic1.id, today: '2026-09-03' });

		// Mark readiness for both classes on topic 1 lessons, and class A on topic 2 lesson
		setReadiness(db, l1.id, classA.id, true);
		setReadiness(db, l2.id, classA.id, true);
		setReadiness(db, l3.id, classA.id, true);
		setReadiness(db, l1.id, classB.id, true);
		setReadiness(db, l2.id, classB.id, true);

		// Unassign topic1 from classA
		const [assignedTopic1] = assignedTopicsOf(db, classA.id).filter(
			(at) => at.topicId === topic1.id
		);
		unassignTopic(db, { classId: classA.id, id: assignedTopic1.id, today: '2026-09-03' });

		// Check database readiness rows:
		// classA's marks on l1 and l2 are gone, while l3 remains
		const classAReadiness = db
			.select()
			.from(schema.readiness)
			.where(eq(schema.readiness.classId, classA.id))
			.all();
		expect(classAReadiness.map((r) => r.lessonId)).toEqual([l3.id]);

		// classB's marks on l1 and l2 are still intact
		const classBReadiness = db
			.select()
			.from(schema.readiness)
			.where(eq(schema.readiness.classId, classB.id))
			.all();
		expect(classBReadiness.map((r) => r.lessonId).sort()).toEqual([l1.id, l2.id].sort());
	});

	test('deleteLesson takes its marks', () => {
		const { db, course, classA, classB, atDir: dir } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [l1, l2] = makeLessons(db, topic.id, 2);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		assignTopic(db, { classId: classB.id, topicId: topic.id, today: '2026-09-03' });

		setReadiness(db, l1.id, classA.id, true);
		setReadiness(db, l1.id, classB.id, true);
		setReadiness(db, l2.id, classA.id, true);

		// Delete lesson l1
		deleteLesson(db, { id: l1.id, today: '2026-09-03', dir });

		// Readiness rows for l1 are deleted
		const l1Readiness = db
			.select()
			.from(schema.readiness)
			.where(eq(schema.readiness.lessonId, l1.id))
			.all();
		expect(l1Readiness).toHaveLength(0);

		// Readiness rows for l2 remain intact
		const l2Readiness = db
			.select()
			.from(schema.readiness)
			.where(eq(schema.readiness.lessonId, l2.id))
			.all();
		expect(l2Readiness).toHaveLength(1);
		expect(l2Readiness[0].classId).toBe(classA.id);
	});

	test('moveLessonToTopic keeps a Lesson marks unchanged', () => {
		const { db, course, classA } = setUp();
		const topic1 = makeTopic(db, course.id, 'Forces');
		const topic2 = makeTopic(db, course.id, 'Energy');
		const [l1] = makeLessons(db, topic1.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic1.id, today: '2026-09-03' });

		setReadiness(db, l1.id, classA.id, true);

		moveLessonToTopic(db, { id: l1.id, topicId: topic2.id, today: '2026-09-03' });

		const marks = db
			.select()
			.from(schema.readiness)
			.where(and(eq(schema.readiness.lessonId, l1.id), eq(schema.readiness.classId, classA.id)))
			.all();
		expect(marks).toHaveLength(1);
	});
});

describe('a Standalone Lesson', () => {
	test('a taught Lesson whose Topic is cleared still shows its title in the Session panel, the Agenda and the Calendar, with no Topic name', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [l1] = makeLessons(db, topic.id, 2);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		// Teach the first two lessons by advancing past their dates.
		// classA's slots: Thu 3 Sep P5 (l1), P6 (l2). today=5 Sep puts both in the past.
		expect(classSchedule(db, { classId: classA.id, today: '2026-09-05' }).history).toHaveLength(2);

		// Record readiness on l1 — it must survive clearing the Topic.
		setReadiness(db, l1.id, classA.id, true);

		// Clear the Topic, making l1 a Standalone Lesson.
		db.run(sql`update "lesson" set "topic_id" = NULL where "id" = ${l1.id}`);

		// 1) Session panel: still shows l1's title and no topic name
		const detail = sessionDetail(db, { classId: classA.id, date: '2026-09-03', period: 5 });
		expect(detail).not.toBeNull();
		expect(detail!.lesson).not.toBeNull();
		expect(detail!.lesson!.title).toBe(l1.title);

		// 2) Agenda: l1 appears with no topic name (topicName is null)
		const agendaRows = agenda(db, { today: '2026-09-03', horizonDays: 14 });
		const l1AgendaRows = agendaRows.filter((r) => r.lesson?.id === l1.id);
		for (const row of l1AgendaRows) {
			expect(row.lesson!.topicName).toBeNull();
		}

		// 3) Calendar: lesson cell shows no topic name
		const week = calendarWeek(db, { weekCommencing: '2026-08-31', today: '2026-09-05' });
		expect(week).not.toBeNull();
		const l1CalendarCells = week!.cells.filter(
			(c) => c.kind === 'lesson' && c.lesson?.title === l1.title
		);
		for (const cell of l1CalendarCells) {
			expect(cell.lesson!.topicName).toBeNull();
		}

		// 4) Planning tab lists l1 with no topic name and no course name
		const stream = planningStream(db, '2026-09-05');
		const l1Entry = stream.find((e) => e.id === l1.id);
		expect(l1Entry).not.toBeUndefined();
		expect(l1Entry!.topicName).toBeNull();
		expect(l1Entry!.courseName).toBeNull();
		expect(l1Entry!.occurrence).toBeNull();

		// 5) Readiness rows survive clearing the Topic
		const marks = db
			.select()
			.from(schema.readiness)
			.where(and(eq(schema.readiness.lessonId, l1.id), eq(schema.readiness.classId, classA.id)))
			.all();
		expect(marks).toHaveLength(1);

		// 6) l1 is never Scheduled (Standalone Lessons reach no Class's Lesson stream)
		const result = classSchedule(db, { classId: classA.id, today: '2026-09-05' });
		const l1Scheduled = result.scheduled.filter((s) => s.lessonId === l1.id);
		expect(l1Scheduled).toHaveLength(0);
	});
});
