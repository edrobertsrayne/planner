import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { failingCommit, failingRederive, makeLessons, makeTopic, setUp } from './fixtures';
import {
	assignTopic,
	blockDay,
	blockSlot,
	classSchedule,
	createLesson,
	deleteLesson,
	deleteTopic,
	editLesson,
	endSlot,
	moveLesson,
	placeLesson,
	recordContinuation,
	removeContinuation,
	removePlacement,
	sessionDetail,
	takeSlot,
	unblockDay,
	unblockSlot,
	writeTeachingNote
} from './index';
import { rederive, rewindBoundary, scheduleFor, type Db } from './derive';
import { teachingNoteOf } from './teaching-notes';
import * as schema from '../db/schema';

// Every scheduling write answers with its Rewind report, so no caller can drop it. The report
// lists the Placements a Rewind moved, and nothing else: a Teaching note follows its Lesson
// (ADR-0026), so no noted Session is at risk.
describe('every scheduling write answers with its Rewind report', () => {
	test('assignTopic answers with the Lessons it added and an empty report', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 2);

		const report = assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		expect(report.placementsMoved).toEqual([]);
		expect(report.added.map((l) => l.title)).toEqual(['Lesson 1', 'Lesson 2']);
		expect(report.skipped).toEqual([]);
	});

	test('recordContinuation answers with an empty report', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 5);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-01' });

		const report = recordContinuation(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			today: '2026-09-13'
		});

		expect(report).toEqual({ placementsMoved: [] });
	});

	test('a Continuation keeps the Teaching note of the Lesson it pushes right', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 5);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-01' });

		// Five Lessons fill 3 Sep P5, 3 Sep P6, 8 Sep P2, 11 Sep P4 and 14 Sep P3. The teacher
		// notes 14 Sep P3: Lesson 5. Continuing 3 Sep P5 pushes Lesson 5 to the next Slot.
		writeTeachingNote(db, {
			classId: classA.id,
			lessonId: lessons[4].id,
			date: '2026-09-14',
			period: 3,
			note: 'cover needed'
		});
		recordContinuation(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			today: '2026-09-13'
		});

		expect(teachingNoteOf(db, classA.id, lessons[4].id)).toBe('cover needed');
		const schedule = classSchedule(db, { classId: classA.id, today: '2026-09-13' });
		const lesson5 = [...schedule.history, ...schedule.scheduled].find(
			(s) => s.lessonId === lessons[4].id
		)!;
		expect(lesson5.date > '2026-09-14' || lesson5.period !== 3).toBe(true);
		const detail = sessionDetail(db, {
			classId: classA.id,
			date: lesson5.date,
			period: lesson5.period,
			today: '2026-09-13'
		});
		expect(detail?.note).toBe('cover needed');
	});
});

// Authoring writes that touch a Sequence answer with the same report. Creating and moving a
// Lesson re-derive nothing (ADR-0026).
describe('a Lesson write answers with the Rewind report', () => {
	const today = '2026-09-01';

	test('createLesson answers with the Lesson only and changes no Sequence', () => {
		const { db, course, classA } = setUp();
		const forces = makeTopic(db, course.id, 'Forces');
		makeLessons(db, forces.id, 1);
		assignTopic(db, { classId: classA.id, topicId: forces.id, today });
		const before = classSchedule(db, { classId: classA.id, today });

		const result = createLesson(db, { topicId: forces.id, title: 'Extra' });

		expect(result.lesson.title).toBe('Extra');
		expect(Object.keys(result)).toEqual(['lesson']);
		expect(classSchedule(db, { classId: classA.id, today })).toEqual(before);
	});

	test('moveLesson changes no Sequence', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 2);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });
		const before = classSchedule(db, { classId: classA.id, today });

		moveLesson(db, { topicId: topic.id, id: lessons[1].id, direction: 'up' });

		expect(classSchedule(db, { classId: classA.id, today })).toEqual(before);
	});

	test('deleteLesson of a Lesson in a Sequence re-derives the Class and answers with an empty report', () => {
		const { db, course, classA, atDir } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });

		const result = deleteLesson(db, { id: lessons[1].id, today, dir: atDir, confirmed: true });

		expect(result).toMatchObject({ placementsMoved: [] });
		const scheduled = classSchedule(db, { classId: classA.id, today }).scheduled;
		expect(scheduled.map((s) => s.lessonId)).toEqual([lessons[0].id, lessons[2].id]);
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

	test('a cross-day Placement re-derived from its second day reports no move once part 1 is history', () => {
		const { db, classA } = setUp();
		const [lesson] = db
			.insert(schema.lesson)
			.values({ title: 'Trip prep', position: 0, length: 2 })
			.returning()
			.all();

		// Anchored on the Thursday double's later Period: a Length-2 run from there also takes
		// Tue 8 Sep P2, so its two parts fall on different days.
		const anchor = classSchedule(db, { classId: classA.id, today: '2026-09-01' }).openSlots.find(
			(slot) => slot.date === '2026-09-03' && slot.period === 6
		)!;
		db.insert(schema.placement)
			.values({ classId: classA.id, date: anchor.date, slotId: anchor.slotId, lessonId: lesson.id })
			.run();
		rederive(db, classA.id, '2026-09-01');

		// Part 1 is history now and part 2 still lies ahead: a run in progress, not a move.
		const after = classSchedule(db, { classId: classA.id, today: '2026-09-08' });
		expect(after.history).toContainEqual(
			expect.objectContaining({ date: '2026-09-03', period: 6, lessonId: lesson.id })
		);
		expect(after.scheduled).toContainEqual(
			expect.objectContaining({ date: '2026-09-08', period: 2, lessonId: lesson.id, part: 2 })
		);
		expect(rederive(db, classA.id, '2026-09-08').placementsMoved).toEqual([]);
	});

	test("a Rewind crossing a Placement's date keeps the Teaching note with the Placement's Lesson", () => {
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
		writeTeachingNote(db, {
			classId: classA.id,
			lessonId: lesson.id,
			date: anchor.date,
			period: anchor.period,
			note: 'Went well'
		});

		// A Blocked Day entered after the fact, on the Placement's own date: a Rewind whose
		// boundary crosses it.
		db.insert(schema.blockedDay).values({ date: anchor.date }).run();
		const report = rederive(db, classA.id, anchor.date);

		expect(report.placementsMoved).toHaveLength(1);
		expect(report.placementsMoved[0].date > anchor.date).toBe(true);
		const moved = sessionDetail(db, {
			classId: classA.id,
			date: report.placementsMoved[0].date,
			period: report.placementsMoved[0].period,
			today: anchor.date
		});
		expect(moved?.lesson?.title).toBe('Revision');
		expect(moved?.note).toBe('Went well');
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

// Every scheduling write is its input row plus a re-derivation, and the two commit together: a
// reader never sees a Length with its Classes half re-derived, and a process that stops part-way
// leaves the input exactly as it was rather than stored with the Sessions it did not reach.
describe('a scheduling write and its re-derivation commit together', () => {
	// Every table a scheduling write can touch, read whole. Comparing this before and after a write
	// whose re-derivation failed is the whole claim: nothing committed.
	function snapshot(db: Db) {
		return {
			session: db.select().from(schema.session).all(),
			continuation: db.select().from(schema.continuation).all(),
			placement: db.select().from(schema.placement).all(),
			slot: db.select().from(schema.slot).all(),
			blockedDay: db.select().from(schema.blockedDay).all(),
			blockedSlot: db.select().from(schema.blockedSlot).all(),
			lesson: db.select().from(schema.lesson).all(),
			classLesson: db.select().from(schema.classLesson).all(),
			readiness: db.select().from(schema.readiness).all(),
			teachingNote: db.select().from(schema.teachingNote).all(),
			link: db.select().from(schema.link).all(),
			attachment: db.select().from(schema.attachment).all()
		};
	}

	type Fixture = ReturnType<typeof setUp>;

	// Arranges the write's input on the real handle, then answers the write itself — handed the
	// handle whose re-derivation fails. `statement` names the Session write the fault is injected
	// at, since a re-derivation inserts, updates or deletes depending on the input.
	type Case = {
		name: string;
		statement?: 'insert' | 'update' | 'delete' | 'any';
		prepare: (db: Db, fx: Fixture) => (failing: Db) => unknown;
	};

	const aSlotOf = (db: Db, classId: string) =>
		db
			.select()
			.from(schema.slot)
			.all()
			.find((slot) => slot.classId === classId)!;

	const aSessionOf = (db: Db, classId: string) =>
		db
			.select()
			.from(schema.session)
			.all()
			.filter((session) => session.classId === classId)
			.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.period - b.period))[0];

	// A Sequence long enough that its Sessions reach the dates the cases disrupt.
	const withSequence = (db: Db, fx: Fixture, count = 5) => {
		const topic = makeTopic(db, fx.course.id, 'Forces');
		makeLessons(db, topic.id, count);
		assignTopic(db, { classId: fx.classA.id, topicId: topic.id, today: '2026-09-01' });
	};

	const cases: Case[] = [
		{
			name: 'editLesson',
			prepare: (db, fx) => {
				const topic = makeTopic(db, fx.course.id, 'Forces');
				const [lesson] = makeLessons(db, topic.id, 2);
				assignTopic(db, { classId: fx.classA.id, topicId: topic.id, today: '2026-09-01' });
				return (failing) =>
					editLesson(failing, { id: lesson.id, change: { length: 3 }, today: '2026-09-03' });
			}
		},
		{
			// Its own cascade deletes Sessions before the re-derivation runs, so the fault is
			// aimed at the re-derivation's insert rather than at the first Session write.
			name: 'deleteLesson',
			statement: 'insert',
			prepare: (db, fx) => {
				const topic = makeTopic(db, fx.course.id, 'Forces');
				const lessons = makeLessons(db, topic.id, 3);
				assignTopic(db, { classId: fx.classA.id, topicId: topic.id, today: '2026-09-04' });
				return (failing) =>
					deleteLesson(failing, {
						id: lessons[1].id,
						today: '2026-09-03',
						dir: fx.atDir,
						confirmed: true
					});
			}
		},
		{
			name: 'placeLesson',
			prepare: (db, fx) => {
				const slot = aSlotOf(db, fx.classA.id);
				return (failing) =>
					placeLesson(failing, {
						classId: fx.classA.id,
						date: '2026-09-14',
						slotId: slot.id,
						title: 'Assembly',
						today: '2026-09-03'
					});
			}
		},
		{
			name: 'removePlacement',
			prepare: (db, fx) => {
				const slot = aSlotOf(db, fx.classA.id);
				const { lesson } = placeLesson(db, {
					classId: fx.classA.id,
					date: '2026-09-14',
					slotId: slot.id,
					title: 'Assembly',
					today: '2026-09-03'
				});
				const [placement] = db
					.select()
					.from(schema.placement)
					.where(eq(schema.placement.lessonId, lesson.id))
					.all();
				return (failing) => removePlacement(failing, { id: placement.id, today: '2026-09-03' });
			}
		},
		{
			name: 'blockDay',
			prepare: (db, fx) => {
				withSequence(db, fx, 12);
				return (failing) => blockDay(failing, { date: '2026-09-16', today: '2026-09-03' });
			}
		},
		{
			name: 'blockSlot',
			prepare: (db, fx) => {
				withSequence(db, fx, 12);
				const slot = aSlotOf(db, fx.classA.id);
				return (failing) =>
					blockSlot(failing, {
						classId: fx.classA.id,
						date: '2026-09-14',
						slotId: slot.id,
						note: 'Trip',
						today: '2026-09-03'
					});
			}
		},
		{
			name: 'unblockDay',
			prepare: (db, fx) => {
				withSequence(db, fx, 12);
				blockDay(db, { date: '2026-09-16', today: '2026-09-03' });
				return (failing) => unblockDay(failing, { date: '2026-09-16', today: '2026-09-03' });
			}
		},
		{
			name: 'unblockSlot',
			prepare: (db, fx) => {
				withSequence(db, fx, 12);
				const slot = aSlotOf(db, fx.classA.id);
				blockSlot(db, {
					classId: fx.classA.id,
					date: '2026-09-14',
					slotId: slot.id,
					note: 'Trip',
					today: '2026-09-03'
				});
				const [row] = db.select().from(schema.blockedSlot).all();
				return (failing) => unblockSlot(failing, { id: row.id, today: '2026-09-03' });
			}
		},
		{
			name: 'recordContinuation',
			prepare: (db, fx) => {
				withSequence(db, fx);
				const session = aSessionOf(db, fx.classA.id);
				return (failing) =>
					recordContinuation(failing, {
						classId: fx.classA.id,
						date: session.date,
						period: session.period,
						today: session.date
					});
			}
		},
		{
			name: 'removeContinuation',
			prepare: (db, fx) => {
				withSequence(db, fx);
				const session = aSessionOf(db, fx.classA.id);
				recordContinuation(db, {
					classId: fx.classA.id,
					date: session.date,
					period: session.period,
					today: session.date
				});
				return (failing) =>
					removeContinuation(failing, {
						classId: fx.classA.id,
						date: session.date,
						period: session.period,
						today: session.date
					});
			}
		},
		{
			name: 'endSlot',
			prepare: (db, fx) => {
				withSequence(db, fx, 12);
				const slot = aSlotOf(db, fx.classA.id);
				return (failing) =>
					endSlot(failing, { id: slot.id, from: '2026-09-14', today: '2026-09-03' });
			}
		},
		{
			name: 'takeSlot',
			prepare: (db, fx) => {
				withSequence(db, fx, 12);
				return (failing) =>
					takeSlot(failing, {
						classId: fx.classA.id,
						week: 'A',
						day: 2,
						period: 2,
						from: '2026-09-14',
						today: '2026-09-03'
					});
			}
		}
	];

	test.each(cases)(
		'$name commits nothing when its re-derivation fails',
		({ statement, prepare }) => {
			const fx = setUp();
			const write = prepare(fx.db, fx);
			const before = snapshot(fx.db);

			expect(() => write(failingRederive(fx.db, statement))).toThrow('re-derivation failed');

			expect(snapshot(fx.db)).toEqual(before);
		}
	);

	test('deleteTopic commits nothing when the commit fails', () => {
		const fx = setUp();
		const topic = makeTopic(fx.db, fx.course.id, 'Forces');
		makeLessons(fx.db, topic.id, 2);
		const before = snapshot(fx.db);

		expect(() => deleteTopic(failingCommit(fx.db), topic.id, { confirmed: true })).toThrow(
			'COMMIT failed'
		);

		expect(snapshot(fx.db)).toEqual(before);
	});
});
