import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, setUp } from './fixtures';
import {
	assignTopic,
	attachTag,
	attachmentsDir,
	blockDay,
	blockSlot,
	classSchedule,
	createAttachment,
	createLink,
	recordContinuation,
	sessionDetail,
	setReadiness,
	writeSessionNote
} from './index';
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
		let report: ReturnType<typeof blockDay> | undefined;
		expect(() => {
			report = blockDay(db, { date: '2026-09-03', note: 'Snow day', today: '2026-09-10' });
		}).not.toThrow();
		expect(report).toMatchObject({ ok: true, atRisk: [] });

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
		expect(detail!.lesson!.tags).toEqual([]);
		expect(detail!.lesson!.attachments).toMatchObject([{ filename: 'worksheet.pdf', size: 2 }]);

		setReadiness(db, lesson.id, classA.id, true);
		const readyDetail = sessionDetail(db, { classId: classA.id, date: '2026-09-03', period: 5 });
		expect(readyDetail?.ready).toBe(true);
	});

	test('a Lesson with Tags shows them on the Session panel', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [lesson] = makeLessons(db, topic.id, 1);
		attachTag(db, { lessonId: lesson.id, name: 'Practical' });
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const detail = sessionDetail(db, { classId: classA.id, date: '2026-09-03', period: 5 });

		expect(detail!.lesson!.tags).toEqual(['Practical']);
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
