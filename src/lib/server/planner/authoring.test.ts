import type { Database } from 'bun:sqlite';
import { sql } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, setUp, setUpAuthoring } from './fixtures';
import {
	assignTopic,
	attachTag,
	classSchedule,
	classesTaughtLesson,
	createCourse,
	createLesson,
	createLink,
	createTopic,
	deleteCourse,
	deleteLesson,
	deleteLink,
	deleteTopic,
	detachTag,
	importTopic,
	lessonDetail,
	lessonsOf,
	linksOf,
	listCourses,
	listTagNames,
	moveLesson,
	moveLessonToTopic,
	moveLink,
	NameCollision,
	renameCourse,
	renameLesson,
	renameTopic,
	setLessonStatus,
	tagsByLesson,
	tagsOf,
	topicsOf,
	updateLesson,
	updateLink
} from './index';
import * as schema from '../db/schema';

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

// Import creates one Topic with its Lessons and Links in a single all-or-nothing transaction
// (issue #139). It targets a Course by existing id or by name, creating the Course inline when
// the name is new.
describe('importing a Topic with its Lessons and Links', () => {
	test('creates a new Course, its Topic, Lessons and Links in one call', () => {
		const { db, client } = setUpAuthoring();

		const result = importTopic(
			db,
			client,
			{
				courseName: 'Year 9 Physics',
				topicName: 'Forces',
				lessons: [
					{
						title: 'Newton I',
						links: [{ url: 'https://example.com/a', label: 'Reading' }]
					},
					{ title: 'Newton II' }
				]
			},
			'2026-09-03'
		);

		if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
		expect(result.courseCreated).toBe(true);
		expect(result.course.name).toBe('Year 9 Physics');
		expect(result.topic.name).toBe('Forces');
		expect(result.lessons.map((l) => l.title)).toEqual(['Newton I', 'Newton II']);

		expect(listCourses(db)).toHaveLength(1);
		expect(topicsOf(db, result.course.id).map((t) => t.name)).toEqual(['Forces']);
		expect(lessonsOf(db, result.topic.id).map((l) => l.title)).toEqual(['Newton I', 'Newton II']);
		expect(linksOf(db, result.lessons[0].id).map((l) => l.url)).toEqual(['https://example.com/a']);
	});

	test('targets an existing Course by id and leaves it uncreated', () => {
		const { db, client } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });

		const result = importTopic(
			db,
			client,
			{ courseId: course.id, topicName: 'Waves', lessons: [{ title: 'Reflection' }] },
			'2026-09-03'
		);

		if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
		expect(result.courseCreated).toBe(false);
		expect(result.course.id).toBe(course.id);
		expect(listCourses(db)).toHaveLength(1);
	});

	test('refuses when the course field carries both id and name, or neither', () => {
		const { db, client } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });

		const both = importTopic(
			db,
			client,
			{
				courseId: course.id,
				courseName: 'Year 9 Physics',
				topicName: 'Waves',
				lessons: []
			},
			'2026-09-03'
		);
		expect(both).toMatchObject({ ok: false, status: 400 });

		const neither = importTopic(db, client, { topicName: 'Waves', lessons: [] }, '2026-09-03');
		expect(neither).toMatchObject({ ok: false, status: 400 });

		expect(topicsOf(db, course.id)).toHaveLength(0);
	});

	test('refuses a Topic name that collides in the target Course, creating nothing', () => {
		const { db, client } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		createTopic(db, { courseId: course.id, name: 'Forces' });

		const result = importTopic(
			db,
			client,
			{ courseId: course.id, topicName: 'forces', lessons: [{ title: 'Newton I' }] },
			'2026-09-03'
		);

		expect(result).toMatchObject({ ok: false, status: 409 });
		expect(topicsOf(db, course.id)).toHaveLength(1);
		expect(lessonsOf(db, topicsOf(db, course.id)[0].id)).toHaveLength(0);
	});

	test('a failure partway through leaves no Course, Topic, Lesson or Link behind', () => {
		const { db, client } = setUpAuthoring();

		// A Link missing its NOT NULL label reaches the database and throws mid-transaction —
		// the route validates this away in practice, but importTopic must still roll back cleanly
		// if anything downstream of the Topic insert fails.
		const result = importTopic(
			db,
			client,
			{
				courseName: 'Year 9 Physics',
				topicName: 'Forces',
				lessons: [
					{
						title: 'Newton I',
						links: [{ url: 'https://example.com/a', label: undefined as unknown as string }]
					}
				]
			},
			'2026-09-03'
		);

		expect(result).toMatchObject({ ok: false, status: 500 });
		expect(listCourses(db)).toHaveLength(0);
	});

	test('a failure answers with the fixed reason and carries the cause', () => {
		const { db, client } = setUpAuthoring();

		// A COMMIT that never lands — the answer must say why, not throw the cause away.
		const failing = {
			run: (sql: string) => {
				if (sql === 'COMMIT') throw new Error('COMMIT failed');
				client.run(sql);
			}
		};

		const result = importTopic(
			db,
			failing as unknown as Database,
			{ courseName: 'Year 9 Physics', topicName: 'Forces', lessons: [{ title: 'Newton I' }] },
			'2026-09-03'
		);

		if (result.ok) throw new Error('expected failure');
		expect(result.error).toBe('Import failed.');
		expect((result.cause as Error).message).toBe('COMMIT failed');
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

		expect(lessonDetail(db, lesson.id)).toEqual({ ...lesson, links: [], tags: [] });
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

// A Tag is a short, user-typed label reused by trimmed + case-insensitive name (issue #245).
// Attaching never refuses a match — it reuses the existing Tag rather than creating a duplicate.
// Detaching removes only the one lesson_tag row: the Tag itself, and any other Lesson's
// attachment to it, survive.
describe('Tags on a Lesson', () => {
	function setUpLesson() {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });
		const lesson = createLesson(db, { topicId: topic.id, title: 'Newton I', today: '2026-09-03' });
		return { db, topic, lesson };
	}

	test('attaching a name that matches an existing Tag reuses it, trimmed and case-insensitive', () => {
		const { db, lesson } = setUpLesson();

		const first = attachTag(db, { lessonId: lesson.id, name: 'Practical' });
		if (!first.ok) throw new Error('expected ok');
		expect(first.tags).toEqual(['Practical']);

		const other = createLesson(db, {
			topicId: lesson.topicId!,
			title: 'Newton II',
			today: '2026-09-03'
		});
		const second = attachTag(db, { lessonId: other.id, name: '  practical  ' });
		if (!second.ok) throw new Error('expected ok');
		expect(second.tags).toEqual(['Practical']);

		// One Tag row, attached to both Lessons.
		expect(db.select().from(schema.tag).all()).toHaveLength(1);
	});

	test('attaching a name with no match creates a new Tag', () => {
		const { db, lesson } = setUpLesson();

		attachTag(db, { lessonId: lesson.id, name: 'Practical' });
		attachTag(db, { lessonId: lesson.id, name: 'Trip' });

		expect(db.select().from(schema.tag).all()).toHaveLength(2);
		expect(tagsOf(db, lesson.id)).toEqual(['Practical', 'Trip']);
	});

	test('a Lesson carries more than one Tag at once', () => {
		const { db, lesson } = setUpLesson();

		attachTag(db, { lessonId: lesson.id, name: 'Practical' });
		attachTag(db, { lessonId: lesson.id, name: 'Demonstration' });

		expect(tagsOf(db, lesson.id)).toEqual(['Demonstration', 'Practical']);
		expect(lessonDetail(db, lesson.id)!.tags).toEqual(['Demonstration', 'Practical']);
	});

	test('attaching the same Tag twice is idempotent, not a duplicate row', () => {
		const { db, lesson } = setUpLesson();

		attachTag(db, { lessonId: lesson.id, name: 'Practical' });
		attachTag(db, { lessonId: lesson.id, name: 'Practical' });

		expect(tagsOf(db, lesson.id)).toEqual(['Practical']);
	});

	test('an empty or whitespace-only name is refused', () => {
		const { db, lesson } = setUpLesson();

		expect(attachTag(db, { lessonId: lesson.id, name: '   ' })).toEqual({
			ok: false,
			reason: 'empty name'
		});
		expect(tagsOf(db, lesson.id)).toEqual([]);
	});

	test('detaching removes only the one lesson_tag row, leaving the Tag and other attachments', () => {
		const { db, lesson } = setUpLesson();
		const other = createLesson(db, {
			topicId: lesson.topicId!,
			title: 'Newton II',
			today: '2026-09-03'
		});

		attachTag(db, { lessonId: lesson.id, name: 'Practical' });
		attachTag(db, { lessonId: other.id, name: 'Practical' });
		const [tagRow] = db.select().from(schema.tag).all();

		detachTag(db, { lessonId: lesson.id, tagId: tagRow.id });

		expect(tagsOf(db, lesson.id)).toEqual([]);
		expect(tagsOf(db, other.id)).toEqual(['Practical']);
		expect(db.select().from(schema.tag).all()).toHaveLength(1);
	});

	test('detaching a Tag the Lesson does not carry is a no-op, not an error', () => {
		const { db, lesson } = setUpLesson();
		attachTag(db, { lessonId: lesson.id, name: 'Practical' });
		const [tagRow] = db.select().from(schema.tag).all();

		expect(() => detachTag(db, { lessonId: lesson.id, tagId: 'no-such-id' })).not.toThrow();
		expect(tagsOf(db, lesson.id)).toEqual(['Practical']);

		detachTag(db, { lessonId: lesson.id, tagId: tagRow.id });
		expect(() => detachTag(db, { lessonId: lesson.id, tagId: tagRow.id })).not.toThrow();
	});

	test('deleting a Lesson cascades its lesson_tag rows without touching the Tag', () => {
		const { db, lesson } = setUpLesson();
		attachTag(db, { lessonId: lesson.id, name: 'Practical' });

		deleteLesson(db, { id: lesson.id, today: '2026-09-03' });

		expect(db.select().from(schema.lessonTag).all()).toEqual([]);
		expect(db.select().from(schema.tag).all()).toHaveLength(1);
	});

	test('listTagNames lists every distinct Tag name, sorted', () => {
		const { db, lesson } = setUpLesson();
		attachTag(db, { lessonId: lesson.id, name: 'Trip' });
		attachTag(db, { lessonId: lesson.id, name: 'Assessment' });

		expect(listTagNames(db)).toEqual(['Assessment', 'Trip']);
	});

	test('tagsByLesson resolves several Lessons in one batch, some tagged, some not', () => {
		const { db, lesson } = setUpLesson();
		const other = createLesson(db, {
			topicId: lesson.topicId!,
			title: 'Newton II',
			today: '2026-09-03'
		});
		const untagged = createLesson(db, {
			topicId: lesson.topicId!,
			title: 'Newton III',
			today: '2026-09-03'
		});

		attachTag(db, { lessonId: lesson.id, name: 'Practical' });
		attachTag(db, { lessonId: other.id, name: 'Trip' });

		const batch = tagsByLesson(db, [lesson.id, other.id, untagged.id]);
		expect(batch.get(lesson.id)).toEqual(['Practical']);
		expect(batch.get(other.id)).toEqual(['Trip']);
		expect(batch.get(untagged.id)).toBeUndefined();
	});
});

// A Course/Topic with no children goes at once, same as a Lesson always has. One that still
// holds children is refused until the caller confirms, then the whole subtree goes with it —
// except where a Class follows the Course, a Topic is assigned to a Class, or a Lesson has
// already been taught: those refuse unconditionally, confirmed or not.
describe('deleting a Course or a Topic', () => {
	test('an empty Course or Topic deletes at once, unconfirmed', () => {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });

		expect(deleteTopic(db, topic.id, { today: '2026-09-03' })).toEqual({ ok: true });
		expect(deleteCourse(db, course.id, { today: '2026-09-03' })).toEqual({ ok: true });
		expect(listCourses(db)).toEqual([]);
	});

	test('a Topic that still holds Lessons asks for confirmation, then removes them with it', () => {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });
		const lesson = createLesson(db, { topicId: topic.id, title: 'Newton I', today: '2026-09-03' });

		expect(deleteTopic(db, topic.id, { today: '2026-09-03' })).toEqual({
			ok: false,
			reason: 'This Topic still holds Lessons. Remove or detach them first.',
			needsConfirm: true
		});
		expect(lessonsOf(db, topic.id)).toEqual([lesson]);

		expect(deleteTopic(db, topic.id, { today: '2026-09-03', confirmed: true })).toEqual({
			ok: true
		});
		expect(topicsOf(db, course.id)).toEqual([]);
		expect(lessonDetail(db, lesson.id)).toBeNull();
	});

	test('a Course that still holds Topics asks for confirmation, then removes every Topic and Lesson with it', () => {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });
		const lesson = createLesson(db, { topicId: topic.id, title: 'Newton I', today: '2026-09-03' });

		expect(deleteCourse(db, course.id, { today: '2026-09-03' })).toEqual({
			ok: false,
			reason: 'This Course still holds Topics. Remove them first.',
			needsConfirm: true
		});

		expect(deleteCourse(db, course.id, { today: '2026-09-03', confirmed: true })).toEqual({
			ok: true
		});
		expect(listCourses(db)).toEqual([]);
		expect(lessonDetail(db, lesson.id)).toBeNull();
	});

	test('refuses a Course a Class follows, even confirmed', () => {
		const { db, course } = setUp();

		expect(deleteCourse(db, course.id, { today: '2026-09-03', confirmed: true })).toEqual({
			ok: false,
			reason: 'A Class follows this Course, so it cannot be removed.',
			needsConfirm: false
		});
	});

	test('refuses a Topic assigned to a Class, even confirmed', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		expect(deleteTopic(db, topic.id, { today: '2026-09-03', confirmed: true })).toEqual({
			ok: false,
			reason: 'This Topic is assigned to a Class, so it cannot be removed.',
			needsConfirm: false
		});
	});

	test('refuses a Topic holding a Lesson taught elsewhere and later moved in, even confirmed', () => {
		// unassignTopic refuses to unassign a Topic already reached, so the only way a Topic ends
		// up holding an already-taught Lesson while itself unassigned is a Lesson moved in after
		// the fact (moveLessonToTopic) — the loophole this guard exists for.
		const { db, course, classA } = setUp();
		const taughtTopic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, taughtTopic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: taughtTopic.id, today: '2026-09-03' });

		const otherCourse = createCourse(db, { name: 'Year 10 Physics' });
		const targetTopic = createTopic(db, { courseId: otherCourse.id, name: 'Waves' });
		moveLessonToTopic(db, { id: lessons[0].id, topicId: targetTopic.id, today: '2026-09-10' });

		expect(deleteTopic(db, targetTopic.id, { today: '2026-09-10', confirmed: true })).toEqual({
			ok: false,
			reason: 'This Topic holds a Lesson that has already been taught, so it cannot be removed.',
			needsConfirm: false
		});

		expect(deleteCourse(db, otherCourse.id, { today: '2026-09-10', confirmed: true })).toEqual({
			ok: false,
			reason:
				'A Topic in this Course holds a Lesson that has already been taught, so it cannot be removed.',
			needsConfirm: false
		});
	});
});
