import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import {
	failingRederive,
	makeLessons,
	makeTopic,
	refused,
	setUp,
	setUpAuthoring
} from './fixtures';
import {
	assignTopic,
	attachmentsOf,
	classSchedule,
	classesTaughtLesson,
	createAttachment,
	createCourse,
	createLesson,
	createLink,
	createTopic,
	deleteLesson,
	editLesson,
	lessonDetail,
	lessonsOf,
	moveLesson,
	placeLesson,
	setReadiness,
	updateLink
} from './index';
import { TODAY, datesOf, sequenceOf } from './authoring-fixtures';
import * as schema from '../db/schema';

describe('reordering and moving Lessons', () => {
	function setUpTopics() {
		const { db, atDir: dir } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });
		const otherTopic = createTopic(db, { courseId: course.id, name: 'Waves' });
		return { db, course, topic, otherTopic, dir };
	}

	test('Lessons are reordered up and down within the Topic', () => {
		const { db, topic } = setUpTopics();
		const { lesson: first } = createLesson(db, {
			topicId: topic.id,
			title: 'A'
		});
		const { lesson: second } = createLesson(db, {
			topicId: topic.id,
			title: 'B'
		});
		const { lesson: third } = createLesson(db, {
			topicId: topic.id,
			title: 'C'
		});

		moveLesson(db, { topicId: topic.id, id: third.id, direction: 'up' });
		expect(lessonsOf(db, topic.id).map((l) => l.id)).toEqual([first.id, third.id, second.id]);

		moveLesson(db, { topicId: topic.id, id: first.id, direction: 'down' });
		expect(lessonsOf(db, topic.id).map((l) => l.id)).toEqual([third.id, first.id, second.id]);

		// A move past either end is a no-op, not an error.
		moveLesson(db, { topicId: topic.id, id: third.id, direction: 'up' });
		expect(lessonsOf(db, topic.id).map((l) => l.id)).toEqual([third.id, first.id, second.id]);
	});

	test('a Lesson moves to a different Topic, keeping its body, links and Length', () => {
		const { db, topic, otherTopic } = setUpTopics();
		const { lesson } = createLesson(db, {
			topicId: topic.id,
			title: 'Newton I'
		});
		editLesson(db, {
			id: lesson.id,
			change: { body: 'Objectives: state the First Law.', length: 2 },
			today: '2026-09-03'
		});
		const link = createLink(db, {
			lessonId: lesson.id,
			label: 'Slides',
			url: 'https://example.com/slides'
		});
		const { lesson: existingLesson } = createLesson(db, {
			topicId: otherTopic.id,
			title: 'Existing'
		});

		const moved = editLesson(db, {
			id: lesson.id,
			change: { topicId: otherTopic.id },
			today: '2026-09-03'
		})!.lesson;

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
		const { db, topic, dir } = setUpTopics();
		const { lesson } = createLesson(db, {
			topicId: topic.id,
			title: 'Newton I'
		});
		const link = createLink(db, { lessonId: lesson.id, label: 'Slides', url: 'https://a.example' });

		const result = deleteLesson(db, { id: lesson.id, today: '2026-09-03', dir });

		expect(result).toMatchObject({ lesson: { id: lesson.id } });
		expect(lessonsOf(db, topic.id)).toEqual([]);
		expect(lessonDetail(db, lesson.id)).toBeNull();
		expect(() =>
			updateLink(db, { id: link.id, label: 'x', url: 'https://x.example' })
		).not.toThrow();
	});

	test('refuses to delete a Lesson that a Class has already been taught', () => {
		const { db, course, classA, atDir: dir } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 1);

		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		refused(
			() => deleteLesson(db, { id: lessons[0].id, today: '2026-09-10', dir }),
			'conflict',
			'A Class has already been taught this Lesson, so it cannot be removed.'
		);
	});

	test('refuses to delete a Lesson with a Session today, even confirmed', () => {
		const { db, course, classA, atDir: dir } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		refused(
			() => deleteLesson(db, { id: lessons[0].id, today: '2026-09-03', dir, confirmed: true }),
			'conflict',
			'A Class has already been taught this Lesson, so it cannot be removed.'
		);
	});

	test('refuses to delete a Lesson that a Placement names, naming the way out', () => {
		const { db, classA, atDir: dir } = setUp();
		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3)!;

		const placed = placeLesson(db, {
			classId: classA.id,
			date: '2026-09-14',
			slotId: mondaySlot.id,
			title: 'Assembly',
			today: '2026-09-03'
		});

		refused(
			() => deleteLesson(db, { id: placed.lesson.id, today: '2026-09-03', dir }),
			'conflict',
			'A Placement names this Lesson, so it cannot be removed. Remove the Placement first.'
		);
	});

	describe('a Lesson that a Sequence holds', () => {
		function setUpHeld() {
			const { db, course, classA, classB, atDir: dir } = setUp();
			const topic = makeTopic(db, course.id, 'Forces');
			const lessons = makeLessons(db, topic.id, 4);
			// A boundary after TODAY keeps every Session in the future, so no Lesson is Fixed yet.
			assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-04' });
			assignTopic(db, { classId: classB.id, topicId: topic.id, today: '2026-09-04' });
			return { db, classA, classB, lessons, dir };
		}

		test('asks first, naming the Classes, and deletes nothing', () => {
			const { db, classA, classB, lessons, dir } = setUpHeld();
			const datesA = datesOf(db, classA.id);

			expect(deleteLesson(db, { id: lessons[1].id, today: TODAY, dir })).toEqual({
				needsConfirm: true,
				reason: `This Lesson is in ${classB.label} and ${classA.label}'s Sequences. Delete it?`
			});

			expect(lessonDetail(db, lessons[1].id)).not.toBeNull();
			expect(sequenceOf(db, classA.id)).toHaveLength(4);
			expect(datesOf(db, classA.id)).toEqual(datesA);
		});

		test('on confirm, deletes it with its entries, marks and Teaching notes, and re-derives the Classes', () => {
			const { db, classA, classB, lessons, dir } = setUpHeld();
			const [first, second, third, fourth] = lessons;
			setReadiness(db, second.id, classA.id, true);
			setReadiness(db, second.id, classB.id, true);
			db.insert(schema.teachingNote)
				.values({ classId: classA.id, lessonId: second.id, body: 'Mind the ramps.' })
				.run();
			const datesA = datesOf(db, classA.id);

			const result = deleteLesson(db, { id: second.id, today: TODAY, dir, confirmed: true });

			expect(result).toMatchObject({ lesson: { id: second.id }, placementsMoved: [] });
			expect(lessonDetail(db, second.id)).toBeNull();
			expect(db.select().from(schema.readiness).all()).toEqual([]);
			expect(db.select().from(schema.teachingNote).all()).toEqual([]);
			for (const classId of [classA.id, classB.id]) {
				expect(sequenceOf(db, classId)).toEqual([first.id, third.id, fourth.id]);
				const taught = classSchedule(db, { classId, today: TODAY }).scheduled.map(
					(s) => s.lessonId
				);
				expect(taught).not.toContain(second.id);
			}
			expect(datesOf(db, classA.id)).not.toEqual(datesA);
		});

		test('is refused once a Class has been taught it, even confirmed', () => {
			const { db, lessons, dir } = setUpHeld();

			refused(
				() => deleteLesson(db, { id: lessons[0].id, today: '2026-09-10', dir, confirmed: true }),
				'conflict',
				'A Class has already been taught this Lesson, so it cannot be removed.'
			);
		});

		test('a failed re-derivation leaves the Lesson, its Sessions and its Attachment files in place', () => {
			const { db, lessons, dir } = setUpHeld();
			const attachment = createAttachment(
				db,
				{
					lessonId: lessons[1].id,
					filename: 'worksheet.pdf',
					mimeType: 'application/pdf',
					bytes: new Uint8Array(2)
				},
				dir
			);
			const sessions = db
				.select()
				.from(schema.session)
				.where(eq(schema.session.lessonId, lessons[1].id))
				.all();
			expect(sessions.length).toBeGreaterThan(0);

			// The re-derivation writes a Session; that is the statement that fails, after the
			// Lesson's own rows have gone in inside the transaction. Only the rollback can bring
			// them back, and nothing brings a file back — so the unlink must not have run.
			expect(() =>
				deleteLesson(failingRederive(db), { id: lessons[1].id, today: TODAY, dir, confirmed: true })
			).toThrow('re-derivation failed');

			expect(lessonDetail(db, lessons[1].id)).not.toBeNull();
			expect(
				db.select().from(schema.session).where(eq(schema.session.lessonId, lessons[1].id)).all()
			).toEqual(sessions);
			expect(attachmentsOf(db, lessons[1].id)).toHaveLength(1);
			expect(existsSync(join(dir, attachment.id))).toBe(true);
		});

		test('is refused while a Placement names it, even confirmed', () => {
			const { db, classB, lessons, dir } = setUpHeld();
			const slot = db
				.select()
				.from(schema.slot)
				.all()
				.find((s) => s.classId === classB.id && s.week === 'A' && s.day === 1 && s.period === 1)!;
			const lastLesson = lessons[3];
			db.insert(schema.placement)
				.values({
					classId: classB.id,
					date: '2026-12-07',
					slotId: slot.id,
					lessonId: lastLesson.id
				})
				.run();

			refused(
				() => deleteLesson(db, { id: lastLesson.id, today: TODAY, dir, confirmed: true }),
				'conflict',
				'A Placement names this Lesson, so it cannot be removed. Remove the Placement first.'
			);
		});
	});
});

describe('edits to the shared plan change no Sequence', () => {
	function setUpSequence() {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: TODAY });
		return { db, topic, lessons, classA };
	}

	test('creating a Lesson adds it to no Sequence and moves no date', () => {
		const { db, topic, classA } = setUpSequence();
		const sequence = sequenceOf(db, classA.id);
		const dates = datesOf(db, classA.id);

		const { lesson } = createLesson(db, { topicId: topic.id, title: 'New' });

		expect(sequenceOf(db, classA.id)).toEqual(sequence);
		expect(sequenceOf(db, classA.id)).not.toContain(lesson.id);
		expect(datesOf(db, classA.id)).toEqual(dates);
	});

	test('moving a Lesson in its Topic changes the Topic order, no Sequence and no date', () => {
		const { db, topic, lessons, classA } = setUpSequence();
		const sequence = sequenceOf(db, classA.id);
		const dates = datesOf(db, classA.id);

		moveLesson(db, { topicId: topic.id, id: lessons[2].id, direction: 'up' });

		expect(lessonsOf(db, topic.id).map((l) => l.id)).toEqual([
			lessons[0].id,
			lessons[2].id,
			lessons[1].id
		]);
		expect(sequenceOf(db, classA.id)).toEqual(sequence);
		expect(datesOf(db, classA.id)).toEqual(dates);
	});
});

describe('a Length edit re-derives every Class that holds the Lesson', () => {
	test('each Class that holds it in its Sequence or by a Placement gets new dates', () => {
		const { db, course, classA, classB } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [target] = makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: TODAY });
		const classBMonday = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classB.id && s.week === 'A' && s.day === 1 && s.period === 1)!;
		db.insert(schema.placement)
			.values({
				classId: classB.id,
				date: '2026-09-14',
				slotId: classBMonday.id,
				lessonId: target.id
			})
			.run();
		const datesA = datesOf(db, classA.id);
		const datesB = datesOf(db, classB.id);

		editLesson(db, { id: target.id, change: { length: 2 }, today: TODAY });

		for (const classId of [classA.id, classB.id]) {
			const parts = classSchedule(db, { classId, today: TODAY }).scheduled.filter(
				(s) => s.lessonId === target.id
			);
			expect(parts).toHaveLength(2);
		}
		expect(datesOf(db, classA.id)).not.toEqual(datesA);
		expect(datesOf(db, classB.id)).not.toEqual(datesB);
	});

	test('a Class that does not hold the Lesson keeps its dates', () => {
		const { db, course, classA, classB } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [target] = makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: TODAY });
		const datesB = datesOf(db, classB.id);

		editLesson(db, { id: target.id, change: { length: 2 }, today: TODAY });

		expect(datesOf(db, classB.id)).toEqual(datesB);
	});
});

describe('content edits re-derive the schedule from today', () => {
	test('deleting a not-yet-taught Lesson from a Sequence re-derives the rest, once confirmed', () => {
		const { db, course, classA, atDir: dir } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		// 30 Lessons comfortably outlast the ~12 Sessions 9B/Sc1 has by "later" below, so the last
		// one is still safely open-for-teaching, not history.
		const lessons = makeLessons(db, topic.id, 30);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: TODAY });

		const later = '2026-10-01';
		const historyBefore = classSchedule(db, { classId: classA.id, today: later }).history;

		const lastLesson = lessons[lessons.length - 1];
		deleteLesson(db, { id: lastLesson.id, today: later, dir, confirmed: true });

		const after = classSchedule(db, { classId: classA.id, today: later });
		expect(after.history).toEqual(historyBefore);
		expect(after.scheduled.some((s) => s.lessonId === lastLesson.id)).toBe(false);
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
		editLesson(db, { id: lastLesson.id, change: { length: 2 }, today: later });

		const after = classSchedule(db, { classId: classA.id, today: later });
		expect(after.history).toEqual(historyBefore);
		const parts = after.scheduled.filter((s) => s.lessonId === lastLesson.id);
		expect(parts).toHaveLength(2);
	});

	test("changing a Standalone Lesson's Length re-derives every Class holding a Placement of it", () => {
		const { db, classA, classB } = setUp();
		const today = '2026-09-03';
		const slots = db.select().from(schema.slot).all();
		const classAMonday = slots.find(
			(s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3
		)!;
		const classBMonday = slots.find(
			(s) => s.classId === classB.id && s.week === 'A' && s.day === 1 && s.period === 1
		)!;

		const placed = placeLesson(db, {
			classId: classA.id,
			date: '2026-09-14',
			slotId: classAMonday.id,
			title: 'Assembly',
			today
		});
		const lessonId = placed.lesson.id;

		// A second Placement of the same Standalone Lesson, on a different Class — the shortcut
		// derive.test.ts's own placementsMoved tests take, inserting the row directly.
		db.insert(schema.placement)
			.values({ classId: classB.id, date: '2026-09-14', slotId: classBMonday.id, lessonId })
			.run();

		editLesson(db, { id: lessonId, change: { length: 2 }, today });

		const afterA = classSchedule(db, { classId: classA.id, today });
		const afterB = classSchedule(db, { classId: classB.id, today });
		expect(afterA.scheduled.filter((s) => s.lessonId === lessonId)).toHaveLength(2);
		expect(afterB.scheduled.filter((s) => s.lessonId === lessonId)).toHaveLength(2);
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
		expect(classesTaughtLesson(db, { lessonId: lessons[0].id, today: '2026-09-02' })).toEqual([]);
		expect(classesTaughtLesson(db, { lessonId: lessons[0].id, today: '2026-09-03' })).toEqual([
			expect.objectContaining({ id: classA.id })
		]);

		// Assigned with a boundary after the query date, so every Session it creates is dated on or
		// after 20 Sep — none of them can be history as of the 10 Sep query below.
		const topicB = makeTopic(db, course.id, 'Waves');
		const lessonsB = makeLessons(db, topicB.id, 1);
		assignTopic(db, { classId: classB.id, topicId: topicB.id, today: '2026-09-20' });
		expect(classesTaughtLesson(db, { lessonId: lessonsB[0].id, today })).toEqual([]);
	});
});
