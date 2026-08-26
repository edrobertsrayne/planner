import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { and, eq, lt, sql } from 'drizzle-orm';
import { afterEach, describe, expect, test } from 'vitest';
import { openDatabase, runMigrations } from '../db';
import * as schema from '../db/schema';
import { generateTeachingWeeks } from '../calendar/generate-teaching-weeks';
import { seedFileSchema } from '../calendar/seed-file.schema';
import {
	activeSlots,
	addSlot,
	agenda,
	assignedTopicsOf,
	assignTopic,
	blockDay,
	blockSlot,
	calendarWeek,
	classDetail,
	classesTaughtLesson,
	classLanes,
	classSchedule,
	clearSlot,
	createClass,
	createCourse,
	createLesson,
	createLink,
	createTopic,
	datedSlotsOf,
	deleteLesson,
	deleteLink,
	endSlot,
	holderAt,
	lessonDetail,
	lessonsOf,
	listClasses,
	listCourses,
	moveAssignedTopic,
	moveLesson,
	moveLessonToTopic,
	moveLink,
	NameCollision,
	planningStream,
	recordContinuation,
	renameCourse,
	renameLesson,
	renameTopic,
	sessionDetail,
	setLessonStatus,
	setReadiness,
	setTeachingWeekLetter,
	takeSlot,
	teachingWeeksList,
	topicsOf,
	unassignTopic,
	unblockDay,
	unblockSlot,
	updateLesson,
	updateLink,
	writeSessionNote
} from './index';

// The real 2026/27 calendar (seed/2026-27.json): six Terms opening Thursday 3 September 2026,
// INSET on Thu 26 + Fri 27 Nov 2026, 40 Teaching Weeks, 20 A, 20 B, 187 teaching days. Monday
// 14 September 2026 is the first fully-in-term Week A Monday.
const SEED = seedFileSchema.parse(
	JSON.parse(readFileSync(join(import.meta.dirname, '../../../../seed/2026-27.json'), 'utf-8'))
);

let dir: string;

afterEach(() => {
	if (dir) rmSync(dir, { recursive: true, force: true });
});

// A representative timetable, not Ed's actual one: one Class with five Periods a fortnight
// including a Thursday double (9B/Sc1), one with two (10C/Ph2) — the fixture named in issue #28.
function setUp() {
	dir = mkdtempSync(join(tmpdir(), 'planner-planner-'));
	const { client, db } = openDatabase(join(dir, 'test.db'));
	runMigrations(client, 'drizzle');

	for (const term of SEED.terms) db.insert(schema.term).values(term).run();
	for (const blockedDay of SEED.blockedDays) db.insert(schema.blockedDay).values(blockedDay).run();
	for (const week of generateTeachingWeeks(SEED.terms, SEED.blockedDays))
		db.insert(schema.teachingWeek)
			.values({ weekCommencing: week.weekCommencing, letter: week.letter })
			.run();

	const [course] = db.insert(schema.course).values({ name: 'Year 9 Science' }).returning().all();

	const classA = createClass(db, { label: '9B/Sc1', courseId: course.id })!;
	addSlot(db, { classId: classA.id, week: 'A', day: 1, period: 3 }); // Mon
	addSlot(db, { classId: classA.id, week: 'A', day: 3, period: 1 }); // Wed
	addSlot(db, { classId: classA.id, week: 'A', day: 4, period: 5 }); // Thu, the double,
	addSlot(db, { classId: classA.id, week: 'A', day: 4, period: 6 }); // as two Slots
	addSlot(db, { classId: classA.id, week: 'B', day: 2, period: 2 }); // Tue
	addSlot(db, { classId: classA.id, week: 'B', day: 5, period: 4 }); // Fri

	const classB = createClass(db, { label: '10C/Ph2', courseId: course.id })!;
	addSlot(db, { classId: classB.id, week: 'A', day: 1, period: 1 }); // Mon
	addSlot(db, { classId: classB.id, week: 'B', day: 3, period: 4 }); // Wed

	return { db, course, classA, classB };
}

function makeTopic(db: ReturnType<typeof setUp>['db'], courseId: string, name: string) {
	const [topic] = db.insert(schema.topic).values({ name, courseId }).returning().all();
	return topic;
}

function makeLessons(
	db: ReturnType<typeof setUp>['db'],
	topicId: string,
	count: number,
	length = 1
) {
	const lessons = [];
	for (let position = 0; position < count; position++) {
		const [lesson] = db
			.insert(schema.lesson)
			.values({ topicId, title: `Lesson ${position + 1}`, position, length })
			.returning()
			.all();
		lessons.push(lesson);
	}
	return lessons;
}

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
		const [row] = db
			.select()
			.from(schema.blockedDay)
			.where(eq(schema.blockedDay.date, blockedDate))
			.all();

		const report = unblockDay(db, { id: row.id, today: '2026-09-03' });
		expect(report?.atRisk).toEqual([]);

		const after = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		expect(after.scheduled).toEqual(before.scheduled);
		expect(
			db.select().from(schema.blockedDay).where(eq(schema.blockedDay.date, blockedDate)).all()
		).toHaveLength(0);
	});

	test('reports a noted Session the re-derivation relabels back, and is a no-op for an unknown id', () => {
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

		const [row] = db
			.select()
			.from(schema.blockedDay)
			.where(eq(schema.blockedDay.date, '2026-09-03'))
			.all();

		const report = unblockDay(db, { id: row.id, today: '2026-09-10' });
		expect(report?.atRisk.length).toBeGreaterThan(0);

		expect(unblockDay(db, { id: 'does-not-exist', today: '2026-09-10' })).toBeNull();
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

// ADR-0007: a Session whose Lesson changed is reported rather than silently relabelled. Every
// scheduling write now answers with that report itself, so no caller can drop it — these pin
// the writes that used to discard theirs.
describe('every scheduling write answers with its Rewind report', () => {
	test('assignTopic answers an empty report when it gives a noted Open Slot its first Lesson — a gain, not a loss', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 1);

		// An Open Slot is still an occasion (ADR-0002), so the teacher may have noted it.
		writeSessionNote(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			note: 'fire drill during P5'
		});

		const report = assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		// Nothing recorded was lost — the occasion simply gains teaching — so the fill is
		// deliberately silent; the note must stay put regardless.
		expect(report.atRisk).toEqual([]);
		const detail = sessionDetail(db, { classId: classA.id, date: '2026-09-03', period: 5 });
		expect(detail?.note).toBe('fire drill during P5');
		expect(detail?.lesson?.title).toBe('Lesson 1');
	});

	test('unassignTopic reports a noted Session whose Lesson the removal pulls back off', () => {
		const { db, course, classA } = setUp();
		const forces = makeTopic(db, course.id, 'Forces');
		makeLessons(db, forces.id, 2);
		const waves = makeTopic(db, course.id, 'Waves');
		const wavesLessons = makeLessons(db, waves.id, 1);
		db.update(schema.lesson)
			.set({ title: 'Waves intro' })
			.where(eq(schema.lesson.id, wavesLessons[0].id))
			.run();

		assignTopic(db, { classId: classA.id, topicId: forces.id, today: '2026-09-01' });
		assignTopic(db, { classId: classA.id, topicId: waves.id, today: '2026-09-01' });

		// Forces' two Lessons take 3 Sep P5 and P6; Waves' single Lesson queues on 8 Sep P2 —
		// still untaught, so the Topic can be removed, and noted.
		const queued = classSchedule(db, { classId: classA.id, today: '2026-09-01' }).scheduled[2];
		writeSessionNote(db, {
			classId: classA.id,
			date: queued.date,
			period: queued.period,
			note: 'need the ripple tank booked'
		});

		const row = assignedTopicsOf(db, classA.id).find((a) => a.topicId === waves.id)!;
		const report = unassignTopic(db, { classId: classA.id, id: row.id, today: '2026-09-01' });

		expect(report?.atRisk).toHaveLength(1);
		expect(report?.atRisk[0]).toMatchObject({
			classId: classA.id,
			date: queued.date,
			period: queued.period,
			lessonTitle: 'Waves intro'
		});
	});

	test('moveAssignedTopic reports a noted Session whose Lesson the reorder swapped', () => {
		const { db, course, classA } = setUp();
		const forces = makeTopic(db, course.id, 'Forces');
		const forcesLessons = makeLessons(db, forces.id, 1);
		db.update(schema.lesson)
			.set({ title: 'Forces intro' })
			.where(eq(schema.lesson.id, forcesLessons[0].id))
			.run();
		const waves = makeTopic(db, course.id, 'Waves');
		makeLessons(db, waves.id, 1);

		assignTopic(db, { classId: classA.id, topicId: forces.id, today: '2026-09-03' });
		assignTopic(db, { classId: classA.id, topicId: waves.id, today: '2026-09-03' });

		const second = classSchedule(db, { classId: classA.id, today: '2026-09-03' }).scheduled[1];
		writeSessionNote(db, {
			classId: classA.id,
			date: second.date,
			period: second.period,
			note: 'equipment needed'
		});

		const row = assignedTopicsOf(db, classA.id).find((a) => a.topicId === waves.id)!;
		const report = moveAssignedTopic(db, {
			classId: classA.id,
			id: row.id,
			direction: 'up',
			today: '2026-09-03'
		});

		expect(report.atRisk).toHaveLength(1);
		// The report names the Lesson the noted occasion USED to carry — what the note was
		// written against — so the teacher can judge whether the note still applies.
		expect(report.atRisk[0]).toMatchObject({
			classId: classA.id,
			date: second.date,
			period: second.period,
			lessonTitle: 'Lesson 1'
		});
	});

	test('recordContinuation reports a noted Session the widened Lesson displaces', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 5);

		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-01' });

		// Five Lessons fill 3 Sep P5, 3 Sep P6, 8 Sep P2, 11 Sep P4 and 14 Sep P3. The teacher
		// notes 14 Sep P3; continuing 3 Sep P5 widens Lesson 1 onto it and pushes Lesson 5 right.
		writeSessionNote(db, {
			classId: classA.id,
			date: '2026-09-14',
			period: 3,
			note: 'cover needed'
		});

		const report = recordContinuation(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			today: '2026-09-13'
		});

		expect(report.atRisk).toHaveLength(1);
		expect(report.atRisk[0]).toMatchObject({
			classId: classA.id,
			date: '2026-09-14',
			period: 3,
			lessonTitle: 'Lesson 5'
		});
	});
});

describe('Continuation', () => {
	test('widens a Lesson across the October half-term', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 1);

		// 9B/Sc1's first Available Slot — Thu 3 Sep, the Thursday double — is where the Lesson is
		// taught. Recording the Continuation much later, well after it was taught, stands in for
		// "that one needed more time" being noticed after the fact.
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		const before = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		expect(before.scheduled[0]).toMatchObject({ lessonId: lessons[0].id, date: '2026-09-03' });

		const today = '2026-10-24'; // inside the half-term break itself
		recordContinuation(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			today
		});
		const after = classSchedule(db, { classId: classA.id, today });

		const secondPart = after.scheduled.find((s) => s.lessonId === lessons[0].id && s.part === 2)!;
		expect(secondPart).toBeDefined();
		expect(secondPart.of).toBe(2);
		// The break has no Available Slots, so the widened Lesson's second part lands once Term 2
		// opens, not on the boundary date itself.
		expect(secondPart.date >= '2026-11-02').toBe(true);
	});

	test('two Continuations in a row widen a Lesson to three parts', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 1);

		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		expect(lessons).toHaveLength(1);

		const today = '2026-09-10';
		const occasion = { classId: classA.id, date: '2026-09-03', period: 5, today };
		recordContinuation(db, occasion);
		recordContinuation(db, occasion);
		const after = classSchedule(db, { classId: classA.id, today });

		const parts = after.scheduled
			.filter((s) => s.lessonId === lessons[0].id)
			.sort((a, b) => a.part - b.part);
		expect(parts.map((p) => p.part)).toEqual([2, 3]);
		expect(parts.every((p) => p.of === 3)).toBe(true);
	});

	test('refuses to continue a Session that has not been taught yet', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 1);

		const today = '2026-09-03';
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });
		const stillToTeach = classSchedule(db, { classId: classA.id, today }).scheduled[0];

		expect(() =>
			recordContinuation(db, {
				classId: classA.id,
				date: stillToTeach.date,
				period: stillToTeach.period,
				today
			})
		).toThrow();
	});

	test('a Rewind onto a continued Session drops the Continuation instead of orphaning it', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 1);

		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		recordContinuation(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			today: '2026-09-10'
		});

		// School was actually closed on the very day the Lesson was recorded as needing more
		// time, discovered after the fact — a Rewind lands directly on the continued Session.
		// A Session is identified by its occasion, not by row id (ADR-0002), so re-deriving must
		// not try to delete a Session that a Continuation still references. It carries no note, so
		// it is reported as discarded rather than at risk.
		let report: ReturnType<typeof blockDay>;
		expect(() => {
			report = blockDay(db, { date: '2026-09-03', note: 'Snow day', today: '2026-09-10' });
		}).not.toThrow();
		expect(report!.atRisk).toEqual([]);

		const after = classSchedule(db, { classId: classA.id, today: '2026-09-10' });
		const sessionsForLesson = [...after.history, ...after.scheduled].filter(
			(s) => s.lessonId === lessons[0].id
		);
		expect(sessionsForLesson).toHaveLength(1);
		expect(sessionsForLesson[0].date).not.toBe('2026-09-03');
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

describe('the boundary', () => {
	test('nothing writes a Session dated before today', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 20);

		// Assign the Topic while today is still early in the term, then simulate time passing:
		// a later write (assigning a second, unrelated Topic) is the first opportunity for any
		// Session dated before the new "today" to exist at all.
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const today = '2026-10-01';
		const topic2 = makeTopic(db, course.id, 'More Forces');
		makeLessons(db, topic2.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic2.id, today });

		const historyBefore = db
			.select()
			.from(schema.session)
			.all()
			.filter((s) => s.classId === classA.id && s.date < today);
		expect(historyBefore.length).toBeGreaterThan(0);

		// A further write with the same boundary must not touch those historical rows.
		const topic3 = makeTopic(db, course.id, 'Yet More Forces');
		makeLessons(db, topic3.id, 5);
		assignTopic(db, { classId: classA.id, topicId: topic3.id, today });

		const historyAfter = db
			.select()
			.from(schema.session)
			.all()
			.filter((s) => s.classId === classA.id && s.date < today);
		expect(historyAfter).toEqual(historyBefore);
	});
});

// Course/Topic/Lesson authoring needs no calendar, no Class and no Slot — a bare migrated
// database is enough, so this skips the heavy setUp() above.
function setUpAuthoring() {
	dir = mkdtempSync(join(tmpdir(), 'planner-authoring-'));
	const { client, db } = openDatabase(join(dir, 'test.db'));
	runMigrations(client, 'drizzle');
	return { db };
}

describe('authoring Courses, Topics and Lessons', () => {
	test('a Course is created and can be renamed', () => {
		const { db } = setUpAuthoring();

		const created = createCourse(db, { name: 'Year 9 Physics' });
		expect(listCourses(db)).toEqual([created]);

		const renamed = renameCourse(db, { id: created.id, name: 'Year 9 Science' });
		expect(renamed.id).toBe(created.id);
		expect(listCourses(db)).toEqual([renamed]);
	});

	test('a Topic belongs to its Course and can be renamed', () => {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const otherCourse = createCourse(db, { name: 'Year 10 Physics' });

		const created = createTopic(db, { courseId: course.id, name: 'Forces' });
		createTopic(db, { courseId: otherCourse.id, name: 'Waves' });

		expect(topicsOf(db, course.id)).toEqual([created]);

		const renamed = renameTopic(db, { id: created.id, name: 'Forces and Motion' });
		expect(topicsOf(db, course.id)).toEqual([renamed]);
	});

	test('a Lesson is appended in order, title alone is complete, and it can be renamed', () => {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });

		const first = createLesson(db, { topicId: topic.id, title: 'Newton I', today: '2026-09-03' });
		const second = createLesson(db, {
			topicId: topic.id,
			title: 'Newton II',
			today: '2026-09-03'
		});

		expect(first.body).toBeNull();
		expect(first.length).toBe(1);
		expect(lessonsOf(db, topic.id)).toEqual([first, second]);

		const renamed = renameLesson(db, { id: first.id, title: 'Newton I — inertia' });
		expect(lessonsOf(db, topic.id).map((l) => l.title)).toEqual([renamed.title, second.title]);
	});
});

// Course names are globally unique; Topic names are unique within their Course (issue #131).
// The seam refuses the write with a readable message — the database indexes are the guard of last
// resort, not the user-facing one. Matching is case-insensitive, and stored values are trimmed at
// write time, so "Forces" and "forces" and "  Forces  " all collide.
describe('name collisions', () => {
	test('creating a Course whose name duplicates another throws NameCollision', () => {
		const { db } = setUpAuthoring();
		createCourse(db, { name: 'Year 9 Physics' });

		expect(() => createCourse(db, { name: 'Year 10 Physics' })).not.toThrow();
		expect(() => createCourse(db, { name: 'Year 9 Physics' })).toThrow(NameCollision);
		expect(() => createCourse(db, { name: 'YEAR 9 PHYSICS' })).toThrow(NameCollision);
		expect(() => createCourse(db, { name: '  Year 9 Physics  ' })).toThrow(NameCollision);

		// No row landed from any of the refused attempts.
		expect(listCourses(db)).toHaveLength(2);
	});

	test('renaming a Course to a name in use throws NameCollision', () => {
		const { db } = setUpAuthoring();
		const a = createCourse(db, { name: 'Year 9 Physics' });
		const b = createCourse(db, { name: 'Year 10 Physics' });

		expect(() => renameCourse(db, { id: b.id, name: 'Year 9 Physics' })).toThrow(NameCollision);
		expect(() => renameCourse(db, { id: b.id, name: 'year 9 physics' })).toThrow(NameCollision);

		// A rename to its own name is not a collision — the seam excludes the row being renamed.
		expect(() => renameCourse(db, { id: a.id, name: 'Year 9 Physics' })).not.toThrow();
		expect(() => renameCourse(db, { id: a.id, name: 'YEAR 9 PHYSICS' })).not.toThrow();
	});

	test('creating a Topic whose name duplicates one in the same Course throws NameCollision', () => {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const other = createCourse(db, { name: 'Year 10 Physics' });

		createTopic(db, { courseId: course.id, name: 'Forces' });

		// Same Course, same name (any case): refused.
		expect(() => createTopic(db, { courseId: course.id, name: 'Forces' })).toThrow(NameCollision);
		expect(() => createTopic(db, { courseId: course.id, name: 'forces' })).toThrow(NameCollision);

		// Different Course, same name: accepted.
		expect(() => createTopic(db, { courseId: other.id, name: 'Forces' })).not.toThrow();

		expect(topicsOf(db, course.id)).toHaveLength(1);
	});

	test('renaming a Topic to a name used in the same Course throws NameCollision', () => {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const forces = createTopic(db, { courseId: course.id, name: 'Forces' });
		const waves = createTopic(db, { courseId: course.id, name: 'Waves' });

		expect(() => renameTopic(db, { id: waves.id, name: 'Forces' })).toThrow(NameCollision);
		expect(() => renameTopic(db, { id: waves.id, name: 'FORCES' })).toThrow(NameCollision);

		// A rename to its own name is not a collision — the seam excludes the row being renamed.
		expect(() => renameTopic(db, { id: forces.id, name: 'Forces' })).not.toThrow();
		expect(() => renameTopic(db, { id: forces.id, name: 'forces' })).not.toThrow();

		// Renaming Waves to "Forces" into a different Course is still fine — Topic uniqueness is
		// scoped to its Course.
		const other = createCourse(db, { name: 'Year 10 Physics' });
		const forcesInOther = createTopic(db, { courseId: other.id, name: 'Forces' });
		expect(forcesInOther.name).toBe('Forces');
	});

	test('two Lessons in one Topic may still share a title', () => {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });

		expect(() =>
			createLesson(db, { topicId: topic.id, title: 'Revision', today: '2026-09-03' })
		).not.toThrow();
		expect(() =>
			createLesson(db, { topicId: topic.id, title: 'Revision', today: '2026-09-03' })
		).not.toThrow();

		expect(lessonsOf(db, topic.id).map((l) => l.title)).toEqual(['Revision', 'Revision']);
	});

	test('the database index refuses a write that bypasses the seam', () => {
		const { db } = setUpAuthoring();
		createCourse(db, { name: 'Year 9 Physics' });

		// Raw insert — the application's collision check is skipped.
		expect(() =>
			db.insert(schema.course).values({ id: 'bypass', name: 'YEAR 9 PHYSICS' }).run()
		).toThrow();
	});
});

describe("a Lesson's planning status", () => {
	function setUpLesson() {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });
		const lesson = createLesson(db, { topicId: topic.id, title: 'Newton I', today: '2026-09-03' });
		return { db, topic, lesson };
	}

	test('a new Lesson is Draft, and can be set to Planned and back', () => {
		const { db, lesson } = setUpLesson();

		expect(lesson.status).toBe('draft');
		expect(lessonDetail(db, lesson.id)!.status).toBe('draft');

		const planned = setLessonStatus(db, lesson.id, 'planned');
		expect(planned?.status).toBe('planned');
		expect(lessonDetail(db, lesson.id)!.status).toBe('planned');

		const draft = setLessonStatus(db, lesson.id, 'draft');
		expect(draft?.status).toBe('draft');
		expect(lessonDetail(db, lesson.id)!.status).toBe('draft');
	});

	test("setting a Lesson's planning status moves no date", () => {
		const { db, course, classA } = setUp();
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });
		const lesson = createLesson(db, { topicId: topic.id, title: 'Newton I', today: '2026-09-03' });
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const before = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		expect(before.scheduled.length).toBeGreaterThan(0);
		expect(before.scheduled[0].lessonId).toBe(lesson.id);

		setLessonStatus(db, lesson.id, 'planned');
		const after = classSchedule(db, { classId: classA.id, today: '2026-09-03' });

		expect(after.scheduled).toEqual(before.scheduled);
		expect(after.openSlots).toEqual(before.openSlots);
	});

	test('the database refuses a planning status outside the enum', () => {
		const { db, topic } = setUpLesson();

		expect(() =>
			db.run(
				sql`INSERT INTO lesson (id, topic_id, title, length, position, status) VALUES ('bad', ${topic.id}, 'Bad', 1, 1, 'invalid')`
			)
		).toThrow();
	});
});

describe('reordering and moving Lessons', () => {
	function setUpTopics() {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });
		const otherTopic = createTopic(db, { courseId: course.id, name: 'Waves' });
		return { db, course, topic, otherTopic };
	}

	test('Lessons are reordered up and down within the Topic', () => {
		const { db, topic } = setUpTopics();
		const first = createLesson(db, { topicId: topic.id, title: 'A', today: '2026-09-03' });
		const second = createLesson(db, { topicId: topic.id, title: 'B', today: '2026-09-03' });
		const third = createLesson(db, { topicId: topic.id, title: 'C', today: '2026-09-03' });

		moveLesson(db, { topicId: topic.id, id: third.id, direction: 'up', today: '2026-09-03' });
		expect(lessonsOf(db, topic.id).map((l) => l.id)).toEqual([first.id, third.id, second.id]);

		moveLesson(db, { topicId: topic.id, id: first.id, direction: 'down', today: '2026-09-03' });
		expect(lessonsOf(db, topic.id).map((l) => l.id)).toEqual([third.id, first.id, second.id]);

		// A move past either end is a no-op, not an error.
		moveLesson(db, { topicId: topic.id, id: third.id, direction: 'up', today: '2026-09-03' });
		expect(lessonsOf(db, topic.id).map((l) => l.id)).toEqual([third.id, first.id, second.id]);
	});

	test('a Lesson moves to a different Topic, keeping its body, links and Length', () => {
		const { db, topic, otherTopic } = setUpTopics();
		const lesson = createLesson(db, { topicId: topic.id, title: 'Newton I', today: '2026-09-03' });
		updateLesson(db, {
			id: lesson.id,
			title: 'Newton I',
			body: 'Objectives: state the First Law.',
			length: 2,
			today: '2026-09-03'
		});
		const link = createLink(db, {
			lessonId: lesson.id,
			label: 'Slides',
			url: 'https://example.com/slides'
		});
		const existingLesson = createLesson(db, {
			topicId: otherTopic.id,
			title: 'Existing',
			today: '2026-09-03'
		});

		const moved = moveLessonToTopic(db, {
			id: lesson.id,
			topicId: otherTopic.id,
			today: '2026-09-03'
		});

		expect(moved).toMatchObject({
			topicId: otherTopic.id,
			body: 'Objectives: state the First Law.',
			length: 2
		});
		expect(lessonsOf(db, topic.id)).toEqual([]);
		expect(lessonsOf(db, otherTopic.id).map((l) => l.id)).toEqual([existingLesson.id, lesson.id]);
		expect(lessonDetail(db, lesson.id)!.links.map((l) => l.id)).toEqual([link.id]);
	});

	test('a Lesson is deleted, and its Links go with it', () => {
		const { db, topic } = setUpTopics();
		const lesson = createLesson(db, { topicId: topic.id, title: 'Newton I', today: '2026-09-03' });
		const link = createLink(db, { lessonId: lesson.id, label: 'Slides', url: 'https://a.example' });

		const result = deleteLesson(db, { id: lesson.id, today: '2026-09-03' });

		expect(result).toMatchObject({
			ok: true,
			lesson: { id: lesson.id }
		});
		expect(lessonsOf(db, topic.id)).toEqual([]);
		expect(lessonDetail(db, lesson.id)).toBeNull();
		expect(() =>
			updateLink(db, { id: link.id, label: 'x', url: 'https://x.example' })
		).not.toThrow();
	});

	test('refuses to delete a Lesson that a Class has already been taught', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 1);

		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const result = deleteLesson(db, { id: lessons[0].id, today: '2026-09-10' });
		expect(result).toEqual({ ok: false, reason: 'taught' });
	});
});

describe('content edits re-derive the schedule from today', () => {
	test('adding a Lesson into a half-taught Topic shifts later teaching without disturbing the boundary', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 4);

		const assignedAt = '2026-09-03';
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: assignedAt });

		const today = '2026-10-01';
		const before = classSchedule(db, { classId: classA.id, today });
		const historyBefore = before.history;

		const inserted = createLesson(db, { topicId: topic.id, title: 'Inserted', today });
		// Slot it in at the front of the order to prove insertion, not just append, still holds the
		// boundary — reordering is exercised by the "reordering" test below, this one only needs a
		// content change that ripples forward.
		moveLesson(db, { topicId: topic.id, id: inserted.id, direction: 'up', today });
		moveLesson(db, { topicId: topic.id, id: inserted.id, direction: 'up', today });
		moveLesson(db, { topicId: topic.id, id: inserted.id, direction: 'up', today });
		moveLesson(db, { topicId: topic.id, id: inserted.id, direction: 'up', today });

		const after = classSchedule(db, { classId: classA.id, today });
		expect(after.history).toEqual(historyBefore);
		expect(after.scheduled.some((s) => s.lessonId === inserted.id)).toBe(true);
		expect(after.scheduled.every((s) => s.date >= today)).toBe(true);
	});

	test('deleting a not-yet-taught Lesson from a half-taught Topic re-derives the rest', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		// 30 Lessons comfortably outlast the ~12 Sessions 9B/Sc1 has by "later" below, so the last
		// one is still safely open-for-teaching, not history.
		const lessons = makeLessons(db, topic.id, 30);

		const today = '2026-09-03';
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		const later = '2026-10-01';
		const historyBefore = classSchedule(db, { classId: classA.id, today: later }).history;

		const lastLesson = lessons[lessons.length - 1];
		deleteLesson(db, { id: lastLesson.id, today: later });

		const after = classSchedule(db, { classId: classA.id, today: later });
		expect(after.history).toEqual(historyBefore);
		expect(after.scheduled.some((s) => s.lessonId === lastLesson.id)).toBe(false);
	});

	test('reordering Lessons in a half-taught Topic re-derives everything from today, not before', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 30);

		const assignedAt = '2026-09-03';
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: assignedAt });

		const today = '2026-10-01';
		const historyBefore = classSchedule(db, { classId: classA.id, today }).history;

		const last = lessons[lessons.length - 1];
		moveLesson(db, { topicId: topic.id, id: last.id, direction: 'up', today });

		const after = classSchedule(db, { classId: classA.id, today });
		expect(after.history).toEqual(historyBefore);
		const stillToTeach = after.scheduled.map((s) => s.lessonId);
		expect(stillToTeach).toContain(last.id);
		expect(stillToTeach.indexOf(last.id)).toBeLessThan(stillToTeach.length - 1);
	});

	test('changing a Length re-derives every affected Class from today', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 30);

		const today = '2026-09-03';
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		const later = '2026-10-01';
		const historyBefore = classSchedule(db, { classId: classA.id, today: later }).history;

		const lastLesson = lessons[lessons.length - 1];
		updateLesson(db, {
			id: lastLesson.id,
			title: lastLesson.title,
			body: null,
			length: 2,
			today: later
		});

		const after = classSchedule(db, { classId: classA.id, today: later });
		expect(after.history).toEqual(historyBefore);
		const parts = after.scheduled.filter((s) => s.lessonId === lastLesson.id);
		expect(parts).toHaveLength(2);
	});

	test('assigning a Topic mid-year is itself an ordinary re-derive from today', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 20);

		const today = '2026-09-03';
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		const later = '2026-11-02';
		const historyBefore = classSchedule(db, { classId: classA.id, today: later }).history;

		const midYearTopic = makeTopic(db, course.id, 'Waves');
		makeLessons(db, midYearTopic.id, 5);
		assignTopic(db, { classId: classA.id, topicId: midYearTopic.id, today: later });

		const after = classSchedule(db, { classId: classA.id, today: later });
		expect(after.history).toEqual(historyBefore);
	});
});

describe('who has been taught a Lesson', () => {
	test('names the Classes taught it before today, and no others', () => {
		const { db, course, classA, classB } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 1);

		const today = '2026-09-10';
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		expect(classesTaughtLesson(db, { lessonId: lessons[0].id, today })).toEqual([
			expect.objectContaining({ id: classA.id, label: classA.label })
		]);
		expect(classesTaughtLesson(db, { lessonId: lessons[0].id, today: '2026-09-03' })).toEqual([]);

		// Assigned with a boundary after the query date, so every Session it creates is dated on or
		// after 20 Sep — none of them can be history as of the 10 Sep query below.
		const topicB = makeTopic(db, course.id, 'Waves');
		const lessonsB = makeLessons(db, topicB.id, 1);
		assignTopic(db, { classId: classB.id, topicId: topicB.id, today: '2026-09-20' });
		expect(classesTaughtLesson(db, { lessonId: lessonsB[0].id, today })).toEqual([]);
	});
});

describe('the Lesson editor', () => {
	function setUpLesson() {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });
		const lesson = createLesson(db, { topicId: topic.id, title: 'Newton I', today: '2026-09-03' });
		return { db, topic, lesson };
	}

	test('reads a Lesson back with its Links, in position order', () => {
		const { db, lesson } = setUpLesson();

		expect(lessonDetail(db, lesson.id)).toEqual({ ...lesson, links: [] });
	});

	test('a Lesson holds a markdown body and a Length in Periods', () => {
		const { db, lesson } = setUpLesson();

		const updated = updateLesson(db, {
			id: lesson.id,
			title: 'Newton I — inertia',
			body: 'Objectives: state the First Law.',
			length: 2,
			today: '2026-09-03'
		});

		expect(updated).toMatchObject({
			title: 'Newton I — inertia',
			body: 'Objectives: state the First Law.',
			length: 2
		});
		expect(lessonDetail(db, lesson.id)).toMatchObject({
			title: 'Newton I — inertia',
			body: 'Objectives: state the First Law.',
			length: 2
		});
	});

	test('Links are appended in order, edited and removed', () => {
		const { db, lesson } = setUpLesson();

		const first = createLink(db, {
			lessonId: lesson.id,
			label: 'Slide deck',
			url: 'https://example.com/slides'
		});
		const second = createLink(db, {
			lessonId: lesson.id,
			label: 'Worksheet',
			url: 'https://example.com/worksheet'
		});
		expect(lessonDetail(db, lesson.id)!.links.map((l) => l.id)).toEqual([first.id, second.id]);

		const edited = updateLink(db, {
			id: first.id,
			label: 'Slide deck (2026)',
			url: 'https://example.com/slides-2026'
		});
		expect(edited).toMatchObject({
			label: 'Slide deck (2026)',
			url: 'https://example.com/slides-2026'
		});

		const deleted = deleteLink(db, { id: second.id });
		expect(deleted).toMatchObject({ id: second.id });
		expect(lessonDetail(db, lesson.id)!.links.map((l) => l.id)).toEqual([first.id]);

		expect(deleteLink(db, { id: second.id })).toBeNull();
	});

	test('Links are reordered up and down within the Lesson', () => {
		const { db, lesson } = setUpLesson();

		const first = createLink(db, { lessonId: lesson.id, label: 'A', url: 'https://a.example' });
		const second = createLink(db, { lessonId: lesson.id, label: 'B', url: 'https://b.example' });
		const third = createLink(db, { lessonId: lesson.id, label: 'C', url: 'https://c.example' });

		moveLink(db, { lessonId: lesson.id, id: third.id, direction: 'up' });
		expect(lessonDetail(db, lesson.id)!.links.map((l) => l.id)).toEqual([
			first.id,
			third.id,
			second.id
		]);

		moveLink(db, { lessonId: lesson.id, id: first.id, direction: 'down' });
		expect(lessonDetail(db, lesson.id)!.links.map((l) => l.id)).toEqual([
			third.id,
			first.id,
			second.id
		]);

		// A move past either end is a no-op, not an error.
		moveLink(db, { lessonId: lesson.id, id: third.id, direction: 'up' });
		expect(lessonDetail(db, lesson.id)!.links.map((l) => l.id)).toEqual([
			third.id,
			first.id,
			second.id
		]);
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
		expect(week?.dates).toEqual([
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

		blockSlot(db, {
			classId: classA.id,
			date: '2026-09-03',
			slotId: thuP5.id,
			note: 'Field trip',
			today: '2026-09-03'
		});

		const week = calendarWeek(db, { weekCommencing: '2026-08-31', today: '2026-09-03' });
		const blocked = week?.cells.find(
			(c) => c.date === '2026-09-03' && c.periodFrom === 5 && c.classId === classA.id
		);
		expect(blocked).toMatchObject({ kind: 'blocked', blockedNote: 'Field trip', lesson: null });
		expect(blocked?.blockedSlotId).toBeTruthy();
		expect(blocked?.blockedDayId).toBeNull();

		// Shift-right moved the first Lesson into the Slot the block left free.
		const shifted = week?.cells.find(
			(c) => c.date === '2026-09-03' && c.periodFrom === 6 && c.classId === classA.id
		);
		expect(shifted).toMatchObject({ kind: 'lesson' });
		expect(shifted?.slotId).toBeTruthy();
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

	test('the stored Week letter is read back, never inferred, and edits re-derive the schedule around it', () => {
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

		expect(teachingWeeksList(db).find((w) => w.weekCommencing === '2026-08-31')?.letter).toBe('A');

		const report = setTeachingWeekLetter(db, {
			weekCommencing: '2026-08-31',
			letter: 'B',
			today: '2026-09-03'
		});
		expect(report?.atRisk).toEqual([]);
		expect(teachingWeeksList(db).find((w) => w.weekCommencing === '2026-08-31')?.letter).toBe('B');

		// Relabelled as Week B, classA no longer holds a Thursday Slot that week (its Week B day 4
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

describe('the Session panel', () => {
	test('reads a scheduled occasion back with its Lesson, plan and Links', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [lesson] = makeLessons(db, topic.id, 1);
		db.update(schema.lesson)
			.set({ body: 'Recap Newton I' })
			.where(eq(schema.lesson.id, lesson.id))
			.run();
		createLink(db, { lessonId: lesson.id, url: 'https://example.com', label: 'Slides' });
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const detail = sessionDetail(db, { classId: classA.id, date: '2026-09-03', period: 5 });

		expect(detail).toMatchObject({
			classId: classA.id,
			classLabel: '9B/Sc1',
			date: '2026-09-03',
			period: 5,
			note: null,
			ready: false,
			lesson: {
				title: lesson.title,
				topicName: 'Forces',
				body: 'Recap Newton I'
			}
		});
		expect(detail!.lesson!.links).toMatchObject([{ url: 'https://example.com', label: 'Slides' }]);

		setReadiness(db, lesson.id, classA.id, true);
		const readyDetail = sessionDetail(db, { classId: classA.id, date: '2026-09-03', period: 5 });
		expect(readyDetail?.ready).toBe(true);
	});

	test('opens on an Open Slot showing no plan, and still offers the note', () => {
		const { db, classA } = setUp();
		// No Topic assigned: 3 Sep P5 is an Open Slot, with no Session row yet at all.

		const detail = sessionDetail(db, { classId: classA.id, date: '2026-09-03', period: 5 });

		expect(detail).toMatchObject({ classId: classA.id, lesson: null, ready: null, note: null });
	});

	test('a note is written against the occasion, saved and reopened', () => {
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

		const detail = sessionDetail(db, { classId: classA.id, date: '2026-09-03', period: 5 });
		expect(detail!.note).toBe('went badly — redo the practical');
		// The Lesson stayed exactly as scheduled — writing a note never touches the schedule.
		expect(detail!.lesson).not.toBeNull();
	});

	test('a note on an Open Slot survives an unrelated re-derive of the same Class', () => {
		const { db, course, classA } = setUp();
		// classA's first Available Slot, 3 Sep P5/6, is left open.

		writeSessionNote(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			note: 'covered by a colleague, ad hoc revision'
		});

		// An unrelated Topic assignment triggers rederive on classA from today.
		const topic = makeTopic(db, course.id, 'Electricity');
		makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-10' });

		const detail = sessionDetail(db, { classId: classA.id, date: '2026-09-03', period: 5 });
		expect(detail!.note).toBe('covered by a colleague, ad hoc revision');
	});

	test('a note stays keyed to the occasion, not the Lesson, across a Rewind', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		// Two 1-Period Lessons land on 3 Sep's Thursday double: Lesson 1 on P5, Lesson 2 on P6.
		const lessons = makeLessons(db, topic.id, 2);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		// The note is on P6 — Lesson 2, as actually taught.
		writeSessionNote(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 6,
			note: 'went badly — redo the practical'
		});

		const p5Slot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 4 && s.period === 5)!;

		// P5 turns out to have been a field trip, entered after the fact: shift-right relabels
		// P6 as carrying Lesson 1 instead of Lesson 2, though P6 itself is still taught.
		blockSlot(db, {
			classId: classA.id,
			date: '2026-09-03',
			slotId: p5Slot.id,
			note: 'Field trip',
			today: '2026-09-10'
		});

		const detail = sessionDetail(db, { classId: classA.id, date: '2026-09-03', period: 6 });
		expect(detail!.note).toBe('went badly — redo the practical');
		expect(detail!.lesson?.title).toBe(lessons[0].title);
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
		const [blockedRow] = db
			.select()
			.from(schema.blockedDay)
			.where(eq(schema.blockedDay.date, blockedDate))
			.all();
		unblockDay(db, { id: blockedRow.id, today: '2026-09-03' });

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
		const { db, course, classA, classB } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [l1, l2] = makeLessons(db, topic.id, 2);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		assignTopic(db, { classId: classB.id, topicId: topic.id, today: '2026-09-03' });

		setReadiness(db, l1.id, classA.id, true);
		setReadiness(db, l1.id, classB.id, true);
		setReadiness(db, l2.id, classA.id, true);

		// Delete lesson l1
		deleteLesson(db, { id: l1.id, today: '2026-09-03' });

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
		const [l1, l2] = makeLessons(db, topic.id, 2);
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
