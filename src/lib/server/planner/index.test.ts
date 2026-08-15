import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { afterEach, describe, expect, test } from 'vitest';
import { openDatabase, runMigrations } from '../db';
import * as schema from '../db/schema';
import { generateTeachingWeeks } from '../calendar/generate-teaching-weeks';
import { seedFileSchema } from '../calendar/seed-file.schema';
import {
	addSlot,
	assignTopic,
	blockDay,
	blockSlot,
	classSchedule,
	createClass,
	createCourse,
	createLesson,
	createLink,
	createTopic,
	deleteLink,
	lessonDetail,
	lessonsOf,
	listCourses,
	moveLink,
	recordContinuation,
	renameCourse,
	renameLesson,
	renameTopic,
	topicsOf,
	updateLesson,
	updateLink
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

		const first = createLesson(db, { topicId: topic.id, title: 'Newton I' });
		const second = createLesson(db, { topicId: topic.id, title: 'Newton II' });

		expect(first.body).toBeNull();
		expect(first.plannedLength).toBe(1);
		expect(lessonsOf(db, topic.id)).toEqual([first, second]);

		const renamed = renameLesson(db, { id: first.id, title: 'Newton I — inertia' });
		expect(lessonsOf(db, topic.id).map((l) => l.title)).toEqual([renamed.title, second.title]);
	});
});

describe('the Lesson editor', () => {
	function setUpLesson() {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });
		const lesson = createLesson(db, { topicId: topic.id, title: 'Newton I' });
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
			plannedLength: 2
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
