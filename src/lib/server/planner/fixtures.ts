import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';
import { openDatabase, runMigrations } from '../db';
import * as schema from '../db/schema';
import { addSlot, createClass } from './index';

// The real 2026/27 calendar: six Terms opening Thursday 3 September 2026, INSET on Thu 26 +
// Fri 27 Nov 2026, 40 Teaching Weeks, 20 A, 20 B, 187 teaching days. Monday 14 September 2026 is
// the first fully-in-term Week A Monday. The letters are computed from these dates, never stored.
export const TERMS = [
	{ opens: '2026-09-03', closes: '2026-10-23' },
	{ opens: '2026-11-02', closes: '2026-12-22' },
	{ opens: '2027-01-05', closes: '2027-02-12' },
	{ opens: '2027-02-22', closes: '2027-03-26' },
	{ opens: '2027-04-19', closes: '2027-05-28' },
	{ opens: '2027-06-07', closes: '2027-07-19' }
];

export const BLOCKED_DAYS = [
	{ date: '2026-11-26', note: 'INSET' },
	{ date: '2026-11-27', note: 'INSET' }
];

let dir: string;

afterEach(() => {
	if (dir) rmSync(dir, { recursive: true, force: true });
});

// A representative timetable, not Ed's actual one: one Class with five Periods a fortnight
// including a Thursday double (9B/Sc1), one with two (10C/Ph2) — the fixture named in issue #28.
export function setUp() {
	dir = mkdtempSync(join(tmpdir(), 'planner-planner-'));
	const { client, db } = openDatabase(join(dir, 'test.db'));
	runMigrations(client, 'drizzle');

	for (const term of TERMS) db.insert(schema.term).values(term).run();
	for (const blockedDay of BLOCKED_DAYS) db.insert(schema.blockedDay).values(blockedDay).run();

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

	return { db, client, course, classA, classB, dir };
}

export function makeTopic(db: ReturnType<typeof setUp>['db'], courseId: string, name: string) {
	const [topic] = db.insert(schema.topic).values({ name, courseId }).returning().all();
	return topic;
}

export function makeLessons(
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

// Course/Topic/Lesson authoring needs no calendar, no Class and no Slot — a bare migrated
// database is enough, so this skips the heavy setUp() above. The temp directory comes back too:
// attachment storage writes its files beside the database, so its tests assert them there.
export function setUpAuthoring() {
	dir = mkdtempSync(join(tmpdir(), 'planner-authoring-'));
	const { client, db } = openDatabase(join(dir, 'test.db'));
	runMigrations(client, 'drizzle');
	return { db, client, dir };
}
