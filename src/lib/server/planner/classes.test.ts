import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, setUp } from './fixtures';
import {
	activeSlots,
	assignTopic,
	assignedTopicsOf,
	calendarWeek,
	classDetail,
	classLanes,
	classSchedule,
	createClass,
	listClasses,
	moveAssignedTopic,
	unassignTopic,
	writeSessionNote
} from './index';
import * as schema from '../db/schema';

describe('reading a Class schedule back', () => {
	test('lays Assigned-Topic Lessons onto the Class Available Slots in order', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 3);

		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		// Reads go through classSchedule — writes answer only their Rewind report.
		const result = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		expect(result.scheduled.slice(0, 3).map((s) => s.lessonId)).toEqual(lessons.map((l) => l.id));
		// 9B/Sc1's first Available Slot is the Thursday double on the day Term 1 opens.
		expect(result.scheduled[0].date).toBe('2026-09-03');
		expect(result.scheduled[0].period).toBe(5);
	});
});

describe('reading Classes and their Timetable back', () => {
	test('lists Classes alphabetically and reads one back with its Course', () => {
		const { db, course, classA, classB } = setUp();

		expect(listClasses(db).map((c) => c.label)).toEqual(['10C/Ph2', '9B/Sc1']);
		expect(classDetail(db, classA.id)).toMatchObject({ label: '9B/Sc1', courseName: course.name });
		expect(classDetail(db, classB.id)).toMatchObject({ label: '10C/Ph2', courseName: course.name });
		expect(classDetail(db, 'no-such-id')).toBeNull();
	});

	test('activeSlots shows every Class holding a position on a date, not just one', () => {
		const { db, classA, classB } = setUp();

		// Every Slot in setUp holds all year (null bounds), so all 8 are active on any date —
		// the grid it feeds is Week A/B x Day x Period, not tied to what day of the week `on` is.
		const onADate = activeSlots(db, '2026-09-07');
		expect(onADate).toHaveLength(8);
		expect(new Set(onADate.map((s) => s.classId))).toEqual(new Set([classA.id, classB.id]));
	});
});

describe('Class Tones are assigned at creation, never derived (ADR-0013)', () => {
	test('consecutive creations walk far apart on the wheel', () => {
		const { db, course, classA, classB } = setUp();

		const c3 = createClass(db, { label: '9C/Bi1', courseId: course.id });
		const c4 = createClass(db, { label: '9D/Ch1', courseId: course.id });

		// setUp created two Classes, so the walk has reached its third and fourth positions.
		expect(listClasses(db).find((c) => c.id === classA.id)?.tone).toBe(0);
		expect(listClasses(db).find((c) => c.id === classB.id)?.tone).toBe(4);
		expect(listClasses(db).find((c) => c.id === c3!.id)?.tone).toBe(6);
		expect(listClasses(db).find((c) => c.id === c4!.id)?.tone).toBe(7);
	});

	test('deleting a Class frees its position and moves nobody', () => {
		const { db, course, classA, classB } = setUp();
		db.delete(schema.slot).where(eq(schema.slot.classId, classB.id)).run();
		db.delete(schema.classes).where(eq(schema.classes.id, classB.id)).run();

		const replacement = createClass(db, { label: '10C/Ph2 later set', courseId: course.id })!;

		expect(replacement.tone).toBe(classB.tone); // the freed position is reused
		expect(listClasses(db).find((c) => c.id === classA.id)?.tone).toBe(classA.tone); // unmoved
	});

	test('calendar cells carry their Class Tone', () => {
		const { db, classA, classB } = setUp();

		const week = calendarWeek(db, { weekCommencing: '2026-08-31', today: '2026-09-03' });

		const tones = new Map(week?.cells.map((c) => [c.classId, c.tone] as const));
		expect(tones.get(classA.id)).toBe(classA.tone);
		expect(tones.get(classB.id)).toBe(classB.tone);
	});
});

describe('running out of Available Slots', () => {
	test('a Class whose Assigned Topics outrun the year reports unplaced Lessons rather than dropping them', () => {
		const { db, course, classB } = setUp();
		const topic = makeTopic(db, course.id, 'Everything');
		// 10C/Ph2 has 2 Periods a fortnight; a 300-Lesson Topic cannot fit in one academic year.
		const lessons = makeLessons(db, topic.id, 300);

		assignTopic(db, { classId: classB.id, topicId: topic.id, today: '2026-09-03' });
		const result = classSchedule(db, { classId: classB.id, today: '2026-09-03' });

		expect(result.unplaced.length).toBeGreaterThan(0);
		expect(result.scheduled.length + result.unplaced.length).toBe(lessons.length);
		expect(result.unplaced[0].lessonId).toBe(lessons[result.scheduled.length].id);
	});
});

describe('Open Slots and Runway', () => {
	test('are correct for a Class with Slots left over, which is the normal condition', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 3);

		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		const result = classSchedule(db, { classId: classA.id, today: '2026-09-03' });

		expect(result.unplaced).toEqual([]);
		expect(result.openSlots.length).toBeGreaterThan(0);

		const read = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		expect(read.runway.date).toBe(read.openSlots[0]?.date);
		expect(read.runway.lessonsRemaining).toBe(0);
	});
});

describe('Length', () => {
	test('a Lesson with Length > 1 occupies n consecutive Available Slots as one Lesson', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [wideLesson] = makeLessons(db, topic.id, 1, 2);

		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		const result = classSchedule(db, { classId: classA.id, today: '2026-09-03' });

		const parts = result.scheduled
			.filter((s) => s.lessonId === wideLesson.id)
			.sort((a, b) => a.part - b.part);
		expect(parts.map((p) => `${p.part}/${p.of}`)).toEqual(['1/2', '2/2']);

		const allSlots = result;
		const stream = [...allSlots.history, ...allSlots.scheduled, ...allSlots.openSlots]
			.map((s) => `${s.date}|${s.period}`)
			.sort();
		const iFirst = stream.indexOf(`${parts[0].date}|${parts[0].period}`);
		const iSecond = stream.indexOf(`${parts[1].date}|${parts[1].period}`);
		expect(iSecond).toBe(iFirst + 1);
	});
});

describe('assigning Topics to a Class', () => {
	test('only Topics belonging to the Class’s own Course may be assigned', () => {
		const { db, course, classA } = setUp();
		const otherCourse = db
			.insert(schema.course)
			.values({ name: 'Year 11 Chemistry' })
			.returning()
			.all()[0];
		const foreignTopic = makeTopic(db, otherCourse.id, 'Moles');

		expect(() =>
			assignTopic(db, { classId: classA.id, topicId: foreignTopic.id, today: '2026-09-03' })
		).toThrow();

		const ownTopic = makeTopic(db, course.id, 'Forces');
		expect(() =>
			assignTopic(db, { classId: classA.id, topicId: ownTopic.id, today: '2026-09-03' })
		).not.toThrow();
	});

	test('accumulates one at a time, in the order assigned, shown as the shelf', () => {
		const { db, course, classA } = setUp();
		const forces = makeTopic(db, course.id, 'Forces');
		const waves = makeTopic(db, course.id, 'Waves');

		assignTopic(db, { classId: classA.id, topicId: forces.id, today: '2026-09-03' });
		assignTopic(db, { classId: classA.id, topicId: waves.id, today: '2026-09-03' });

		const shelf = assignedTopicsOf(db, classA.id);
		expect(shelf.map((a) => a.topicName)).toEqual(['Forces', 'Waves']);
	});

	test('reorders freely, and the order is the teaching order', () => {
		const { db, course, classA } = setUp();
		const forces = makeTopic(db, course.id, 'Forces');
		makeLessons(db, forces.id, 2);
		const waves = makeTopic(db, course.id, 'Waves');
		const wavesLessons = makeLessons(db, waves.id, 2);

		assignTopic(db, { classId: classA.id, topicId: forces.id, today: '2026-09-03' });
		assignTopic(db, {
			classId: classA.id,
			topicId: waves.id,
			today: '2026-09-03'
		});
		const wavesRow = assignedTopicsOf(db, classA.id).find((a) => a.topicId === waves.id)!;

		moveAssignedTopic(db, {
			classId: classA.id,
			id: wavesRow.id,
			direction: 'up',
			today: '2026-09-03'
		});

		const shelf = assignedTopicsOf(db, classA.id);
		expect(shelf.map((a) => a.topicName)).toEqual(['Waves', 'Forces']);

		const schedule = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		// Moving Waves up makes its Lesson the first taught — the teaching order is the shelf.
		expect(schedule.scheduled[0].lessonId).toBe(wavesLessons[0].id);
	});

	test('unassigns a Topic the Class has not reached', () => {
		const { db, course, classA } = setUp();
		const forces = makeTopic(db, course.id, 'Forces');
		makeLessons(db, forces.id, 3);

		assignTopic(db, { classId: classA.id, topicId: forces.id, today: '2026-09-03' });
		const row = assignedTopicsOf(db, classA.id)[0];

		unassignTopic(db, { classId: classA.id, id: row.id, today: '2026-09-03' });

		expect(assignedTopicsOf(db, classA.id)).toEqual([]);
	});

	test('refuses to unassign a Topic the Class has already been taught', () => {
		const { db, course, classA } = setUp();
		const forces = makeTopic(db, course.id, 'Forces');
		makeLessons(db, forces.id, 3);

		assignTopic(db, { classId: classA.id, topicId: forces.id, today: '2026-09-03' });
		const row = assignedTopicsOf(db, classA.id)[0];

		expect(() =>
			unassignTopic(db, { classId: classA.id, id: row.id, today: '2026-09-10' })
		).toThrow();
	});
});

describe('the Classes view', () => {
	test('a lane reports progress, last taught with its note, next up, and Runway', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		// classA's first Available Slot is 3 Sep's Thursday double (P5, P6): Lesson 1 lands on
		// P5, Lesson 2 on P6 — both taught by the time `today` moves past them.
		writeSessionNote(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 6,
			note: 'went well'
		});

		// classB's Slot at that boundary doesn't matter here; classA's next Available Slot after
		// the Thursday double is 7 Sep — so 5 Sep sits between "taught" and "still to come".
		const [lane] = classLanes(db, { today: '2026-09-05', classId: classA.id });

		expect(lane.classId).toBe(classA.id);
		expect(lane.taught).toBe(2);
		expect(lane.total).toBe(3);
		expect(lane.lastTaught).toMatchObject({
			date: '2026-09-03',
			period: 6,
			title: lessons[1].title,
			topicName: 'Forces',
			note: 'went well'
		});
		expect(lane.nextUp).toMatchObject({ title: lessons[2].title, topicName: 'Forces' });
		expect(lane.unplacedCount).toBe(0);
		expect(lane.runway).toEqual(
			classSchedule(db, { classId: classA.id, today: '2026-09-05' }).runway
		);
	});

	test('a Class with no Assigned Topics has nothing taught, nothing queued, and an untouched Runway', () => {
		const { db, classA } = setUp();

		const [lane] = classLanes(db, { today: '2026-09-03', classId: classA.id });

		expect(lane.taught).toBe(0);
		expect(lane.total).toBe(0);
		expect(lane.lastTaught).toBeNull();
		expect(lane.nextUp).toBeNull();
		// Every Available Slot is Open — the Runway date is the first of them, straight away.
		expect(lane.runway.date).toBe('2026-09-03');
		expect(lane.runway.lessonsRemaining).toBe(0);
	});

	test('a Class whose Assigned Topics outrun the year reports its unplaced count on the lane', () => {
		const { db, course, classB } = setUp();
		const topic = makeTopic(db, course.id, 'Everything');
		makeLessons(db, topic.id, 300);
		assignTopic(db, { classId: classB.id, topicId: topic.id, today: '2026-09-03' });

		const [lane] = classLanes(db, { today: '2026-09-03', classId: classB.id });

		expect(lane.unplacedCount).toBeGreaterThan(0);
		expect(lane.runway.lessonsRemaining).toBe(lane.unplacedCount);
	});

	test('a lane carries the Tone stored on the Class, so the tile can colour itself', () => {
		const { db, classA } = setUp();

		const [lane] = classLanes(db, { today: '2026-09-03', classId: classA.id });
		const [stored] = listClasses(db).filter((c) => c.id === classA.id);

		expect(stored.tone).toBeDefined();
		expect(lane.tone).toBe(stored.tone);
	});

	test('covers every Class when no classId is given, in the same order as listClasses', () => {
		const { db, course, classA, classB } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const lanes = classLanes(db, { today: '2026-09-03' });

		expect(lanes.map((l) => l.classId)).toEqual([classB.id, classA.id]);
	});
});
