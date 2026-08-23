import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { and, eq, lt } from 'drizzle-orm';
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
	recordContinuation,
	renameCourse,
	renameLesson,
	renameTopic,
	sessionDetail,
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
	plannedLength = 1
) {
	const lessons = [];
	for (let position = 0; position < count; position++) {
		const [lesson] = db
			.insert(schema.lesson)
			.values({ topicId, title: `Lesson ${position + 1}`, position, plannedLength })
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

		const result = assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		expect(result.planned.slice(0, 3).map((s) => s.lessonId)).toEqual(lessons.map((l) => l.id));
		// 9B/Sc1's first Available Slot is the Thursday double on the day Term 1 opens.
		expect(result.planned[0].date).toBe('2026-09-03');
		expect(result.planned[0].period).toBe(5);

		const read = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		expect(read.planned.map((s) => s.lessonId + '|' + s.date + '|' + s.period)).toEqual(
			result.planned.map((s) => s.lessonId + '|' + s.date + '|' + s.period)
		);
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

		const plannedBefore = classSchedule(db, { classId: classA.id, today: '2026-11-24' }).planned;

		endSlot(db, { id: wednesday.id, from: '2027-05-15', today: '2026-11-24' });

		const stillTaught = db
			.select()
			.from(schema.session)
			.where(and(eq(schema.session.classId, classA.id), lt(schema.session.date, '2026-11-24')))
			.all();
		expect(stillTaught).toEqual(taughtBefore);

		// The Wednesday P1 Slot is gone from 15 May, so from then on every planned Session has
		// moved onto one of the Class's remaining Slots — never that position, on or after that
		// date — and the Class has fewer Available Slots to lay Lessons onto than before.
		const plannedAfter = classSchedule(db, { classId: classA.id, today: '2026-11-24' }).planned;
		expect(plannedAfter.length).toBeLessThan(plannedBefore.length);
		expect(
			plannedAfter.some((s) => s.date >= '2027-05-15' && s.period === 1 && s.week === 'A')
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

		const before = {
			a: assignTopic(db, { classId: classA.id, topicId: topicA.id, today: '2026-09-03' }),
			b: assignTopic(db, { classId: classB.id, topicId: topicB.id, today: '2026-09-03' })
		};

		// Mon 14 Sep is a Week A Monday inside term, with no existing Blocked Day — both Classes
		// are taught that day (9B P3, 10C P1).
		const blockedDate = '2026-09-14';
		expect(before.a.planned.some((s) => s.date === blockedDate)).toBe(true);
		expect(before.b.planned.some((s) => s.date === blockedDate)).toBe(true);

		blockDay(db, { date: blockedDate, note: 'Snow day', today: '2026-09-03' });

		const afterA = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		const afterB = classSchedule(db, { classId: classB.id, today: '2026-09-03' });

		// Nothing before the blocked date moved, and no Lesson was dropped.
		const untilBlocked = (planned: typeof before.a.planned) =>
			planned.filter((s) => s.date < blockedDate);
		expect(untilBlocked(afterA.planned)).toEqual(untilBlocked(before.a.planned));
		expect(untilBlocked(afterB.planned)).toEqual(untilBlocked(before.b.planned));
		expect(afterA.planned.map((s) => s.lessonId)).toEqual(lessonsA.map((l) => l.id));
		expect(afterB.planned.map((s) => s.lessonId)).toEqual(lessonsB.map((l) => l.id));

		// No Session lands on the blocked date, and every Session that was due on or after it
		// slides right in order, onto the next Available Slots for that Class.
		expect(afterA.planned.some((s) => s.date === blockedDate)).toBe(false);
		expect(afterB.planned.some((s) => s.date === blockedDate)).toBe(false);
		const oldFromBlocked = before.a.planned.filter((s) => s.date >= blockedDate);
		const newFromBlocked = afterA.planned.filter((s) => s.date >= blockedDate);
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
		const before = assignTopic(db, {
			classId: classB.id,
			topicId: topicB.id,
			today: '2026-09-03'
		});

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
		expect(afterB.planned).toEqual(before.planned);

		const afterA = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		expect(afterA.planned.some((s) => s.date === '2026-09-14' && s.period === 3)).toBe(false);
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
			date: '2026-09-03',
			period: 5,
			lessonId: lessons[0].id
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
		// elsewhere, so this occasion drops out of the plan entirely (it is neither still Planned
		// nor Unplanned). The note is the one irreplaceable thing in the system (#38): it must stay
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

		const before = assignTopic(db, { classId: classA.id, topicId: topicA.id, today: '2026-09-03' });
		assignTopic(db, { classId: classB.id, topicId: topicB.id, today: '2026-09-03' });

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
		expect(after.planned).toEqual(before.planned);
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
		const pushed = classSchedule(db, { classId: classA.id, today: '2026-09-01' }).planned[0];
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

		const before = assignTopic(db, { classId: classA.id, topicId: topicA.id, today: '2026-09-03' });
		assignTopic(db, { classId: classB.id, topicId: topicB.id, today: '2026-09-03' });

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
		expect(after.planned).toEqual(before.planned);
		expect(
			db.select().from(schema.blockedSlot).where(eq(schema.blockedSlot.id, row.id)).all()
		).toHaveLength(0);

		expect(unblockSlot(db, { id: 'does-not-exist', today: '2026-09-03' })).toBeNull();
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
		const before = assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		expect(before.planned[0]).toMatchObject({ lessonId: lessons[0].id, date: '2026-09-03' });

		const today = '2026-10-24'; // inside the half-term break itself
		const after = recordContinuation(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			today
		});

		const secondPart = after.planned.find((s) => s.lessonId === lessons[0].id && s.part === 2)!;
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
		const after = recordContinuation(db, occasion);

		const parts = after.planned
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
		const before = assignTopic(db, { classId: classA.id, topicId: topic.id, today });
		const stillToTeach = before.planned[0];

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
		const sessionsForLesson = [...after.history, ...after.planned].filter(
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

		const result = assignTopic(db, { classId: classB.id, topicId: topic.id, today: '2026-09-03' });

		expect(result.unplaced.length).toBeGreaterThan(0);
		expect(result.planned.length + result.unplaced.length).toBe(lessons.length);
		expect(result.unplaced[0].lessonId).toBe(lessons[result.planned.length].id);
	});
});

describe('Unplanned Slots and Runway', () => {
	test('are correct for a Class with Slots left over, which is the normal condition', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 3);

		const result = assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		expect(result.unplaced).toEqual([]);
		expect(result.unplanned.length).toBeGreaterThan(0);

		const read = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		expect(read.runway.date).toBe(read.unplanned[0]?.date);
		expect(read.runway.lessonsRemaining).toBe(0);
	});
});

describe('Planned Length', () => {
	test('a Lesson with Planned Length > 1 occupies n consecutive Available Slots as one Lesson', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [wideLesson] = makeLessons(db, topic.id, 1, 2);

		const result = assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const parts = result.planned
			.filter((s) => s.lessonId === wideLesson.id)
			.sort((a, b) => a.part - b.part);
		expect(parts.map((p) => `${p.part}/${p.of}`)).toEqual(['1/2', '2/2']);

		const allSlots = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		const stream = [...allSlots.history, ...allSlots.planned, ...allSlots.unplanned]
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
		expect(first.plannedLength).toBe(1);
		expect(lessonsOf(db, topic.id)).toEqual([first, second]);

		const renamed = renameLesson(db, { id: first.id, title: 'Newton I — inertia' });
		expect(lessonsOf(db, topic.id).map((l) => l.title)).toEqual([renamed.title, second.title]);
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

	test('a Lesson moves to a different Topic, keeping its body, links and Planned Length', () => {
		const { db, topic, otherTopic } = setUpTopics();
		const lesson = createLesson(db, { topicId: topic.id, title: 'Newton I', today: '2026-09-03' });
		updateLesson(db, {
			id: lesson.id,
			title: 'Newton I',
			body: 'Objectives: state the First Law.',
			plannedLength: 2,
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
			plannedLength: 2
		});
		expect(lessonsOf(db, topic.id)).toEqual([]);
		expect(lessonsOf(db, otherTopic.id).map((l) => l.id)).toEqual([existingLesson.id, lesson.id]);
		expect(lessonDetail(db, lesson.id)!.links.map((l) => l.id)).toEqual([link.id]);
	});

	test('a Lesson is deleted, and its Links go with it', () => {
		const { db, topic } = setUpTopics();
		const lesson = createLesson(db, { topicId: topic.id, title: 'Newton I', today: '2026-09-03' });
		const link = createLink(db, { lessonId: lesson.id, label: 'Slides', url: 'https://a.example' });

		const deleted = deleteLesson(db, { id: lesson.id, today: '2026-09-03' });

		expect(deleted).toMatchObject({ id: lesson.id });
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

		expect(() => deleteLesson(db, { id: lessons[0].id, today: '2026-09-10' })).toThrow();
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
		expect(after.planned.some((s) => s.lessonId === inserted.id)).toBe(true);
		expect(after.planned.every((s) => s.date >= today)).toBe(true);
	});

	test('deleting a not-yet-taught Lesson from a half-taught Topic re-derives the rest', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		// 30 Lessons comfortably outlast the ~12 Sessions 9B/Sc1 has by "later" below, so the last
		// one is still safely unplanned-for-teaching, not history.
		const lessons = makeLessons(db, topic.id, 30);

		const today = '2026-09-03';
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		const later = '2026-10-01';
		const historyBefore = classSchedule(db, { classId: classA.id, today: later }).history;

		const lastLesson = lessons[lessons.length - 1];
		deleteLesson(db, { id: lastLesson.id, today: later });

		const after = classSchedule(db, { classId: classA.id, today: later });
		expect(after.history).toEqual(historyBefore);
		expect(after.planned.some((s) => s.lessonId === lastLesson.id)).toBe(false);
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
		const stillToTeach = after.planned.map((s) => s.lessonId);
		expect(stillToTeach).toContain(last.id);
		expect(stillToTeach.indexOf(last.id)).toBeLessThan(stillToTeach.length - 1);
	});

	test('changing a Planned Length re-derives every affected Class from today', () => {
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
			plannedLength: 2,
			today: later
		});

		const after = classSchedule(db, { classId: classA.id, today: later });
		expect(after.history).toEqual(historyBefore);
		const parts = after.planned.filter((s) => s.lessonId === lastLesson.id);
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

	test('a Lesson holds a markdown body and a Planned Length in Periods', () => {
		const { db, lesson } = setUpLesson();

		const updated = updateLesson(db, {
			id: lesson.id,
			title: 'Newton I — inertia',
			body: 'Objectives: state the First Law.',
			plannedLength: 2,
			today: '2026-09-03'
		});

		expect(updated).toMatchObject({
			title: 'Newton I — inertia',
			body: 'Objectives: state the First Law.',
			plannedLength: 2
		});
		expect(lessonDetail(db, lesson.id)).toMatchObject({
			title: 'Newton I — inertia',
			body: 'Objectives: state the First Law.',
			plannedLength: 2
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
		makeLessons(db, waves.id, 2);

		assignTopic(db, { classId: classA.id, topicId: forces.id, today: '2026-09-03' });
		const wavesAssigned = assignTopic(db, {
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
		expect(schedule.planned[0].lessonId).not.toBe(wavesAssigned.planned[0]?.lessonId);
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
	test('runs chronologically across every Class, and a Lesson with Planned Length > 1 is one row', () => {
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

	test('an Unplanned Slot appears as an ordinary row carrying no Lesson', () => {
		const { db, classA } = setUp();
		// No Topic assigned at all: every Available Slot is unplanned.

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
		// Every Available Slot is Unplanned — the Runway date is the first of them, straight away.
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
	test('shows a Lesson, an Unplanned Slot, a Slot outside the Term, and a genuinely free position', () => {
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
		// nothing left to teach — is Unplanned, not blocked.
		expect(at('2026-09-03', 5, classA.id)).toMatchObject({
			kind: 'lesson',
			lesson: { title: lesson.title, topicName: 'Forces' }
		});
		expect(at('2026-09-03', 6, classA.id)).toMatchObject({ kind: 'unplanned', lesson: null });

		// Monday and Wednesday are outside every Term, even though the Timetable puts each Class
		// there — blocked, the same as a Blocked Day, and never mistaken for Unplanned.
		expect(at('2026-08-31', 3, classA.id)).toMatchObject({ kind: 'blocked' });
		expect(at('2026-08-31', 1, classB.id)).toMatchObject({ kind: 'blocked' });
		expect(at('2026-09-02', 1, classA.id)).toMatchObject({ kind: 'blocked' });

		// Friday: neither Class holds a Slot there in Week A at all — genuinely free, not blocked.
		expect(week?.cells.some((c) => c.date === '2026-09-04')).toBe(false);
	});

	test('a Lesson with Planned Length > 1 is one cell spanning its Periods, not two', () => {
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

	test('a Blocked Slot drains the colour and carries its note, distinct from an Unplanned Slot', () => {
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
		const before = assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		expect(before.planned[0]).toMatchObject({ lessonId: lesson.id, date: '2026-09-03', period: 5 });

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
		expect(after.planned.some((s) => s.date === '2026-09-03')).toBe(false);
		expect(after.planned[0]).toMatchObject({ lessonId: lesson.id, date: '2026-09-04', period: 4 });
	});
});

describe('the Session panel', () => {
	test('reads a planned occasion back with its Lesson, plan and Links', () => {
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
			lesson: {
				title: lesson.title,
				topicName: 'Forces',
				body: 'Recap Newton I'
			}
		});
		expect(detail!.lesson!.links).toMatchObject([{ url: 'https://example.com', label: 'Slides' }]);
	});

	test('opens on an Unplanned Slot showing no plan, and still offers the note', () => {
		const { db, classA } = setUp();
		// No Topic assigned: 3 Sep P5 is an Unplanned Slot, with no Session row yet at all.

		const detail = sessionDetail(db, { classId: classA.id, date: '2026-09-03', period: 5 });

		expect(detail).toMatchObject({ classId: classA.id, lesson: null, note: null });
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

	test('a note on an Unplanned Slot survives an unrelated re-derive of the same Class', () => {
		const { db, course, classA } = setUp();
		// classA's first Available Slot, 3 Sep P5/6, is left Unplanned.

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
