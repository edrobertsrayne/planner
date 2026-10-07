import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, setUp } from './fixtures';
import {
	assignedTopicsOf,
	assignTopic,
	classSchedule,
	createLesson,
	deleteLesson,
	moveAssignedTopic,
	moveLesson,
	recordContinuation,
	sessionDetail,
	unassignTopic,
	writeSessionNote
} from './index';
import { rederive, rewindBoundary, scheduleFor } from './derive';
import * as schema from '../db/schema';

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
		const detail = sessionDetail(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			today: '2026-09-03'
		});
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

// A Lesson write in front of a noted future Session changes the Lesson that Session carries, so
// the write must answer with it (ADR-0007).
describe('a Lesson write in front of a noted Session reports that Session', () => {
	const today = '2026-09-01';

	test('createLesson', () => {
		const { db, course, classA } = setUp();
		const forces = makeTopic(db, course.id, 'Forces');
		makeLessons(db, forces.id, 1);
		const waves = makeTopic(db, course.id, 'Waves');
		const [wavesLesson] = makeLessons(db, waves.id, 1);
		db.update(schema.lesson)
			.set({ title: 'Waves intro' })
			.where(eq(schema.lesson.id, wavesLesson.id))
			.run();
		assignTopic(db, { classId: classA.id, topicId: forces.id, today });
		assignTopic(db, { classId: classA.id, topicId: waves.id, today });
		const noted = classSchedule(db, { classId: classA.id, today }).scheduled[1];
		writeSessionNote(db, {
			classId: classA.id,
			date: noted.date,
			period: noted.period,
			note: 'ripple tank'
		});

		const { lesson, atRisk } = createLesson(db, { topicId: forces.id, title: 'Extra', today });

		expect(lesson.title).toBe('Extra');
		expect(atRisk).toHaveLength(1);
		expect(atRisk[0]).toMatchObject({
			classId: classA.id,
			date: noted.date,
			period: noted.period,
			lessonTitle: 'Waves intro'
		});
	});

	test('moveLesson', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 2);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });
		const noted = classSchedule(db, { classId: classA.id, today }).scheduled[1];
		writeSessionNote(db, {
			classId: classA.id,
			date: noted.date,
			period: noted.period,
			note: 'equipment'
		});

		const report = moveLesson(db, {
			topicId: topic.id,
			id: lessons[1].id,
			direction: 'up',
			today
		});

		expect(report.atRisk).toHaveLength(1);
		expect(report.atRisk[0]).toMatchObject({
			date: noted.date,
			period: noted.period,
			lessonTitle: 'Lesson 2'
		});
	});

	test('deleteLesson', () => {
		const { db, course, classA, atDir } = setUp();
		const forces = makeTopic(db, course.id, 'Forces');
		const forcesLessons = makeLessons(db, forces.id, 2);
		const waves = makeTopic(db, course.id, 'Waves');
		const [wavesLesson] = makeLessons(db, waves.id, 1);
		db.update(schema.lesson)
			.set({ title: 'Waves intro' })
			.where(eq(schema.lesson.id, wavesLesson.id))
			.run();
		assignTopic(db, { classId: classA.id, topicId: forces.id, today });
		assignTopic(db, { classId: classA.id, topicId: waves.id, today });
		const noted = classSchedule(db, { classId: classA.id, today }).scheduled[2];
		writeSessionNote(db, {
			classId: classA.id,
			date: noted.date,
			period: noted.period,
			note: 'ripple tank'
		});

		const result = deleteLesson(db, { id: forcesLessons[1].id, today, dir: atDir });

		expect(result?.lesson.title).toBe('Lesson 2');
		expect(result?.atRisk).toHaveLength(1);
		expect(result?.atRisk[0]).toMatchObject({
			date: noted.date,
			period: noted.period,
			lessonTitle: 'Waves intro'
		});
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

// A Placement's Lesson carries no Topic (issue #250), so it never appears via `assignTopic` —
// these insert `placement` and its bare Lesson straight into the schema, the same shortcut the
// engine-level tests take.
describe('placementsMoved', () => {
	test('scheduleFor lays a Placement onto the stream, tagged with its Placement id', () => {
		const { db, classA } = setUp();
		const [lesson] = db
			.insert(schema.lesson)
			.values({ title: 'Assembly', position: 0, length: 1 })
			.returning()
			.all();

		const before = scheduleFor(db, { classId: classA.id, boundary: '2026-09-01' });
		const [anchor] = before.openSlots;

		const [placement] = db
			.insert(schema.placement)
			.values({ classId: classA.id, date: anchor.date, slotId: anchor.slotId, lessonId: lesson.id })
			.returning()
			.all();

		const after = scheduleFor(db, { classId: classA.id, boundary: '2026-09-01' });
		expect(after.scheduled).toContainEqual({
			classId: classA.id,
			date: anchor.date,
			period: anchor.period,
			slotId: anchor.slotId,
			week: anchor.week,
			lessonId: lesson.id,
			part: 1,
			of: 1,
			placementId: placement.id
		});
	});

	test('is empty when a Placement lands on its own anchor', () => {
		const { db, classA } = setUp();
		const [lesson] = db
			.insert(schema.lesson)
			.values({ title: 'Assembly', position: 0, length: 1 })
			.returning()
			.all();

		const before = classSchedule(db, { classId: classA.id, today: '2026-09-01' });
		const [anchor] = before.openSlots;

		db.insert(schema.placement)
			.values({ classId: classA.id, date: anchor.date, slotId: anchor.slotId, lessonId: lesson.id })
			.run();

		const report = rederive(db, classA.id, '2026-09-01');
		expect(report.placementsMoved).toEqual([]);
	});

	test('reports a Placement a Blocked Day forces off its anchor', () => {
		const { db, classA } = setUp();
		const [lesson] = db
			.insert(schema.lesson)
			.values({ title: 'Assembly', position: 0, length: 1 })
			.returning()
			.all();

		const before = classSchedule(db, { classId: classA.id, today: '2026-09-01' });
		const [anchor] = before.openSlots;

		db.insert(schema.placement)
			.values({ classId: classA.id, date: anchor.date, slotId: anchor.slotId, lessonId: lesson.id })
			.run();
		db.insert(schema.blockedDay).values({ date: anchor.date }).run();

		const report = rederive(db, classA.id, '2026-09-01');

		expect(report.placementsMoved).toHaveLength(1);
		const [moved] = report.placementsMoved;
		expect(moved).toMatchObject({
			classId: classA.id,
			lessonTitle: 'Assembly',
			anchorDate: anchor.date
		});
		expect(moved.date > anchor.date).toBe(true);
	});

	test("a Rewind crossing a Placement's date reports its noted Session the same way an ordinary relabel already is", () => {
		const { db, classA } = setUp();
		const [lesson] = db
			.insert(schema.lesson)
			.values({ title: 'Revision', position: 0, length: 1 })
			.returning()
			.all();

		const before = classSchedule(db, { classId: classA.id, today: '2026-09-01' });
		const [anchor] = before.openSlots;

		db.insert(schema.placement)
			.values({ classId: classA.id, date: anchor.date, slotId: anchor.slotId, lessonId: lesson.id })
			.run();
		rederive(db, classA.id, '2026-09-01');

		// A note written against the Placement's own occasion, exactly as any taught Session's is.
		writeSessionNote(db, {
			classId: classA.id,
			date: anchor.date,
			period: anchor.period,
			note: 'Went well'
		});

		// A Blocked Day entered after the fact, on the Placement's own date — a Rewind whose
		// boundary crosses it, the same as it would for a Topic Lesson's Session.
		db.insert(schema.blockedDay).values({ date: anchor.date }).run();
		const report = rederive(db, classA.id, anchor.date);

		expect(report.atRisk).toHaveLength(1);
		expect(report.atRisk[0]).toMatchObject({
			classId: classA.id,
			date: anchor.date,
			period: anchor.period,
			lessonTitle: 'Revision'
		});
	});

	test('a Placement dated before the boundary is history, and live input again once a Rewind crosses back before it', () => {
		const { db, classA } = setUp();
		const [lesson] = db
			.insert(schema.lesson)
			.values({ title: 'Assembly', position: 0, length: 1 })
			.returning()
			.all();

		const before = classSchedule(db, { classId: classA.id, today: '2026-09-01' });
		const [anchor] = before.openSlots;

		db.insert(schema.placement)
			.values({ classId: classA.id, date: anchor.date, slotId: anchor.slotId, lessonId: lesson.id })
			.run();
		rederive(db, classA.id, '2026-09-01');

		// Time passes well beyond the Placement's date — an ordinary re-derive from here on never
		// touches it, exactly like a taught Topic Lesson's Session: it is history now, not a live
		// scheduling input.
		const later = '2026-09-20';
		const untouched = rederive(db, classA.id, later);
		expect(untouched.placementsMoved).toEqual([]);
		const historyAfter = classSchedule(db, { classId: classA.id, today: later }).history;
		expect(historyAfter).toContainEqual(
			expect.objectContaining({ date: anchor.date, period: anchor.period, lessonId: lesson.id })
		);

		// A Blocked Day entered after the fact, on the Placement's own date — the one operation
		// that is allowed to rewrite the past (ADR-0007). The boundary crosses back before the
		// Placement's date, so it is live input again and shift-rights off the newly Blocked Day.
		db.insert(schema.blockedDay).values({ date: anchor.date }).run();
		const report = rederive(db, classA.id, rewindBoundary(anchor.date, later));

		expect(report.placementsMoved).toHaveLength(1);
		expect(report.placementsMoved[0]).toMatchObject({
			classId: classA.id,
			lessonTitle: 'Assembly',
			anchorDate: anchor.date
		});
		expect(report.placementsMoved[0].date > anchor.date).toBe(true);
	});
});
