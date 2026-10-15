import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, refused, setUp } from './fixtures';
import {
	assignTopic,
	attachTag,
	attachmentsDir,
	blockDay,
	blockSlot,
	classSchedule,
	createAttachment,
	createLink,
	deleteLesson,
	placeLesson,
	recordContinuation,
	removeContinuation,
	removePlacement,
	sessionDetail,
	setReadiness,
	teachingNoteOf,
	writeTeachingNote
} from './index';
import { rederive, type WriteReport } from './derive';
import * as schema from '../db/schema';

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
		makeLessons(db, topic.id, 3);

		const today = '2026-09-03';
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });
		const stillToTeach = classSchedule(db, { classId: classA.id, today }).scheduled.find(
			(s) => s.date > today
		);
		expect(stillToTeach).toBeDefined();

		expect(() =>
			recordContinuation(db, {
				classId: classA.id,
				date: stillToTeach!.date,
				period: stillToTeach!.period,
				today
			})
		).toThrow(/not been taught/);
	});

	test('continues a Session taught today', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 1);

		const today = '2026-09-03';
		assignTopic(db, { classId: classA.id, topicId: topic.id, today });
		recordContinuation(db, { classId: classA.id, date: '2026-09-03', period: 5, today });

		const parts = classSchedule(db, { classId: classA.id, today }).scheduled.filter(
			(s) => s.lessonId === lessons[0].id
		);
		expect(parts.length).toBeGreaterThan(0);
		expect(parts.every((p) => p.of === 2)).toBe(true);
		expect(
			sessionDetail(db, { classId: classA.id, date: '2026-09-03', period: 5, today })!.continuations
		).toBe(1);
	});

	test('removing one of two Continuations leaves the Lesson at two parts', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 1);

		const today = '2026-09-10';
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		const occasion = { classId: classA.id, date: '2026-09-03', period: 5, today };
		recordContinuation(db, occasion);
		recordContinuation(db, occasion);
		removeContinuation(db, occasion);

		const parts = classSchedule(db, { classId: classA.id, today })
			.scheduled.filter((s) => s.lessonId === lessons[0].id)
			.sort((a, b) => a.part - b.part);
		expect(parts.map((p) => p.part)).toEqual([2]);
		expect(parts.every((p) => p.of === 2)).toBe(true);
		expect(sessionDetail(db, occasion)!.continuations).toBe(1);
	});

	test('refuses to remove a Continuation the occasion does not hold', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 1);

		const today = '2026-09-10';
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		expect(() =>
			removeContinuation(db, { classId: classA.id, date: '2026-09-03', period: 5, today })
		).toThrow(/No Continuation on 2026-09-03 P5 to remove/);
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
		// not try to delete a Session that a Continuation still references. The Lesson moves to
		// the next Available Slot and the Continuation goes with the closed occasion.
		let report: WriteReport | undefined;
		expect(() => {
			report = blockDay(db, { date: '2026-09-03', note: 'Snow day', today: '2026-09-10' });
		}).not.toThrow();
		expect(report).toEqual({ placementsMoved: [] });

		const after = classSchedule(db, { classId: classA.id, today: '2026-09-10' });
		const sessionsForLesson = [...after.history, ...after.scheduled].filter(
			(s) => s.lessonId === lessons[0].id
		);
		expect(sessionsForLesson).toHaveLength(1);
		expect(sessionsForLesson[0].date).not.toBe('2026-09-03');
	});
});

describe('the Session panel', () => {
	test('reads a scheduled occasion back with its Lesson, plan, Links and Attachments', () => {
		const { db, dir, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [lesson] = makeLessons(db, topic.id, 1);
		db.update(schema.lesson)
			.set({ body: 'Recap Newton I' })
			.where(eq(schema.lesson.id, lesson.id))
			.run();
		createLink(db, { lessonId: lesson.id, url: 'https://example.com', label: 'Slides' });
		const atDir = attachmentsDir(join(dir, 'test.db'));
		createAttachment(
			db,
			{
				lessonId: lesson.id,
				filename: 'worksheet.pdf',
				mimeType: 'application/pdf',
				bytes: new Uint8Array(2)
			},
			atDir
		);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const detail = sessionDetail(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			today: '2026-09-03'
		});

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
		expect(detail!.lesson!.tags).toEqual([]);
		expect(detail!.lesson!.attachments).toMatchObject([{ filename: 'worksheet.pdf', size: 2 }]);

		setReadiness(db, lesson.id, classA.id, true);
		const readyDetail = sessionDetail(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			today: '2026-09-03'
		});
		expect(readyDetail?.ready).toBe(true);
	});

	test('a Lesson with Tags shows them on the Session panel', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [lesson] = makeLessons(db, topic.id, 1);
		attachTag(db, { lessonId: lesson.id, name: 'Practical' });
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const detail = sessionDetail(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			today: '2026-09-03'
		});

		expect(detail!.lesson!.tags).toEqual(['Practical']);
	});

	test('opens on an Open Slot showing no plan, and still offers the note', () => {
		const { db, classA } = setUp();
		// No Topic assigned: 3 Sep P5 is an Open Slot, with no Session row yet at all.

		const detail = sessionDetail(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			today: '2026-09-03'
		});

		expect(detail).toMatchObject({
			classId: classA.id,
			lesson: null,
			ready: null,
			note: null,
			placement: null,
			canPlace: true
		});
	});

	test("canPlace is false once today has passed the Open Slot's date", () => {
		const { db, classA } = setUp();

		const detail = sessionDetail(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			today: '2026-09-04'
		});

		expect(detail?.canPlace).toBe(false);
	});

	// The occupied-occasion door (issue #256): a Placement claims its Slot ahead of the Topic
	// stream, so a Topic Lesson sitting here is no refusal — it shift-rights. Only a Placement
	// already anchored here refuses, which the placed-Lesson test below covers.
	test('canPlace is true on an occasion a Topic Lesson already holds', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const detail = sessionDetail(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			today: '2026-09-03'
		});

		expect(detail?.lesson?.topicName).toBe('Forces');
		expect(detail?.canPlace).toBe(true);
	});

	test("canPlace is false once today has passed the occasion's date", () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const detail = sessionDetail(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			today: '2026-09-04'
		});

		expect(detail?.canPlace).toBe(false);
	});

	test('a placed Lesson carries its Placement id, cleared once the Placement is removed', () => {
		const { db, client, classA } = setUp();
		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3)!;

		const result = placeLesson(db, client, {
			classId: classA.id,
			date: '2026-09-14',
			slotId: mondaySlot.id,
			title: 'Assembly',
			today: '2026-09-03'
		});

		const placed = sessionDetail(db, {
			classId: classA.id,
			date: '2026-09-14',
			period: 3,
			today: '2026-09-03'
		});
		expect(placed?.lesson?.title).toBe('Assembly');
		expect(placed?.lesson?.topicName).toBeNull();
		expect(placed?.canPlace).toBe(false);

		const [placementRow] = db
			.select()
			.from(schema.placement)
			.where(eq(schema.placement.lessonId, result.lesson.id))
			.all();
		expect(placed?.placement?.id).toBe(placementRow.id);
		removePlacement(db, { id: placementRow.id, today: '2026-09-03' });

		const reopened = sessionDetail(db, {
			classId: classA.id,
			date: '2026-09-14',
			period: 3,
			today: '2026-09-03'
		});
		expect(reopened?.lesson).toBeNull();
		expect(reopened?.placement).toBeNull();
		expect(reopened?.canPlace).toBe(true);
	});

	test('a note is written against the occasion, saved and reopened', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		writeTeachingNote(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			note: 'went badly — redo the practical'
		});

		const detail = sessionDetail(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			today: '2026-09-03'
		});
		expect(detail!.note).toBe('went badly — redo the practical');
		// The Lesson stayed exactly as scheduled — writing a note never touches the schedule.
		expect(detail!.lesson).not.toBeNull();
	});

	test('an Open Slot has no note, and a write to it is refused', () => {
		const { db, classA } = setUp();
		// No Topic assigned: 3 Sep P5 is an Open Slot with no Lesson.
		const occasion = { classId: classA.id, date: '2026-09-03', period: 5 };

		refused(
			() => writeTeachingNote(db, { ...occasion, note: 'covered by a colleague' }),
			'invalid',
			'An Open Slot has no Lesson to write a note on.'
		);
		expect(sessionDetail(db, { ...occasion, today: '2026-09-03' })?.note).toBeNull();
	});

	test('a note naming another Lesson than the occasion holds is refused', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [lesson] = makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		const occasion = { classId: classA.id, date: '2026-09-03', period: 5 };

		refused(
			() => writeTeachingNote(db, { ...occasion, lessonId: 'les_other', note: 'wrong Lesson' }),
			'invalid',
			'This Session now has a different Lesson. Reload to see it.'
		);
		expect(db.select().from(schema.teachingNote).all()).toEqual([]);

		writeTeachingNote(db, { ...occasion, lessonId: lesson.id, note: 'right Lesson' });
		expect(teachingNoteOf(db, classA.id, lesson.id)).toBe('right Lesson');
	});

	test('a blank body stores no Teaching note', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [lesson] = makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		const occasion = { classId: classA.id, date: '2026-09-03', period: 5 };

		writeTeachingNote(db, { ...occasion, note: '  \n ' });
		expect(teachingNoteOf(db, classA.id, lesson.id)).toBeNull();
		expect(db.select().from(schema.teachingNote).all()).toEqual([]);

		writeTeachingNote(db, { ...occasion, note: 'went badly' });
		writeTeachingNote(db, { ...occasion, note: '  ' });
		expect(teachingNoteOf(db, classA.id, lesson.id)).toBeNull();
	});

	test('an empty body deletes the Teaching note', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [lesson] = makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		const occasion = { classId: classA.id, date: '2026-09-03', period: 5 };

		writeTeachingNote(db, { ...occasion, note: 'went badly' });
		expect(teachingNoteOf(db, classA.id, lesson.id)).toBe('went badly');

		writeTeachingNote(db, { ...occasion, note: '' });
		expect(teachingNoteOf(db, classA.id, lesson.id)).toBeNull();
		expect(sessionDetail(db, { ...occasion, today: '2026-09-03' })?.note).toBeNull();
		expect(db.select().from(schema.teachingNote).all()).toEqual([]);
	});

	test('both parts of a Length-2 Lesson share one Teaching note', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 1, 2);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		// The two parts sit on 3 Sep P5 and P6.
		writeTeachingNote(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			note: 'finish the circuit next time'
		});

		const second = sessionDetail(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 6,
			today: '2026-09-03'
		});
		expect(second?.note).toBe('finish the circuit next time');
	});

	test("a Continuation's extra Session shares the Lesson's Teaching note", () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		recordContinuation(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			today: '2026-09-03'
		});

		writeTeachingNote(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			note: 'needed a second Period'
		});

		// Continued on the day, the extra Session takes the next Available Slot, 3 Sep P6.
		const extra = sessionDetail(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 6,
			today: '2026-09-03'
		});
		expect(extra?.note).toBe('needed a second Period');
	});

	test('a Teaching note follows its Lesson across a Rewind', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		// Two 1-Period Lessons land on 3 Sep's Thursday double: Lesson 1 on P5, Lesson 2 on P6.
		const lessons = makeLessons(db, topic.id, 2);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		// The note is on P6: Lesson 2, as actually taught.
		writeTeachingNote(db, {
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

		// P5 turns out to have been a field trip, entered after the fact. Lesson 1 moves to P6
		// and Lesson 2 moves to the next Available Slot, 8 Sep P2.
		blockSlot(db, {
			classId: classA.id,
			date: '2026-09-03',
			slotId: p5Slot.id,
			note: 'Field trip',
			today: '2026-09-10'
		});

		const moved = sessionDetail(db, {
			classId: classA.id,
			date: '2026-09-08',
			period: 2,
			today: '2026-09-10'
		});
		expect(moved?.lesson?.title).toBe(lessons[1].title);
		expect(moved?.note).toBe('went badly — redo the practical');

		const relabelled = sessionDetail(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 6,
			today: '2026-09-10'
		});
		expect(relabelled?.lesson?.title).toBe(lessons[0].title);
		expect(relabelled?.note).toBeNull();
	});

	test('a Blocked Day that unschedules a Session deletes its row, not its Teaching note', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [lesson] = makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		writeTeachingNote(db, { classId: classA.id, date: '2026-09-03', period: 5, note: 'trip next' });

		blockDay(db, { date: '2026-09-03', note: 'Snow day', today: '2026-09-10' });

		expect(
			db
				.select()
				.from(schema.session)
				.all()
				.some((s) => s.date === '2026-09-03' && s.period === 5)
		).toBe(false);
		expect(teachingNoteOf(db, classA.id, lesson.id)).toBe('trip next');
	});

	test('Delete Lesson deletes its Teaching note', () => {
		const { db, course, classA, atDir } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [lesson] = makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-01' });
		writeTeachingNote(db, { classId: classA.id, date: '2026-09-03', period: 5, note: 'trip next' });

		deleteLesson(db, { id: lesson.id, today: '2026-09-01', dir: atDir, confirmed: true });

		expect(db.select().from(schema.teachingNote).all()).toEqual([]);
	});

	test('removing the last Placement of a Lesson deletes its Teaching note, and removing another does not', () => {
		const { db, client, classA } = setUp();
		const today = '2026-09-01';
		const [first, second] = classSchedule(db, { classId: classA.id, today }).openSlots;
		const { lesson } = placeLesson(db, client, {
			classId: classA.id,
			date: first.date,
			slotId: first.slotId,
			title: 'Assembly',
			today
		});
		// placeLesson makes a new Lesson on each call, so the second Placement of the same
		// Lesson goes straight into the schema.
		const [other] = db
			.insert(schema.placement)
			.values({
				classId: classA.id,
				date: second.date,
				slotId: second.slotId,
				lessonId: lesson.id
			})
			.returning()
			.all();
		const [placement] = db
			.select()
			.from(schema.placement)
			.all()
			.filter((p) => p.id !== other.id);
		rederive(db, classA.id, today);
		writeTeachingNote(db, {
			classId: classA.id,
			date: first.date,
			period: first.period,
			note: 'went well'
		});

		removePlacement(db, { id: other.id, today });
		expect(teachingNoteOf(db, classA.id, lesson.id)).toBe('went well');

		removePlacement(db, { id: placement.id, today });
		expect(teachingNoteOf(db, classA.id, lesson.id)).toBeNull();
	});
});
