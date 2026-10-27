import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, refused, setSequence, setUp, setUpAuthoring } from './fixtures';
import {
	assignTopic,
	createClass,
	createCourse,
	createLesson,
	importTopic,
	courseSummary,
	courseTiles,
	createTopic,
	deleteCourse,
	deleteTopic,
	editLesson,
	lessonDetail,
	lessonsOf,
	listCourses,
	moveTopicToCourse,
	renameCourse,
	renameTopic,
	setReadiness,
	topicsOf
} from './index';
import { TODAY, datesOf, sequenceOf } from './authoring-fixtures';
import * as schema from '../db/schema';
import { TONE_SEQUENCE } from '$lib/class-tone';

describe('a Course Tone', () => {
	test('each new Course takes the next Tone of the walk, whatever the Classes hold', () => {
		const { db } = setUpAuthoring();
		const first = createCourse(db, { name: 'Year 9 Physics' });
		const course = createCourse(db, { name: 'Year 10 Chemistry' });
		// Classes take Tones from their own walk and do not move the Course walk.
		createClass(db, { label: '9A/Ph1', courseId: first.id });
		createClass(db, { label: '9A/Ph2', courseId: first.id });
		const third = createCourse(db, { name: 'Year 11 Biology' });

		expect([first.tone, course.tone, third.tone]).toEqual(TONE_SEQUENCE.slice(0, 3));
	});

	test('a rename keeps the Tone', () => {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const renamed = renameCourse(db, { id: course.id, name: 'Year 9 Science' });
		expect(renamed.tone).toBe(course.tone);
	});

	test('a Course made by importing a Topic takes the next Tone too', () => {
		const { db } = setUpAuthoring();
		createCourse(db, { name: 'Year 9 Physics' });
		const { course } = importTopic(db, {
			courseName: 'Year 10 Chemistry',
			topicName: 'Moles',
			lessons: [{ title: 'Intro' }]
		});
		const imported = listCourses(db).find((c) => c.id === course.id);
		expect(imported?.tone).toBe(TONE_SEQUENCE[1]);
	});
});

describe('a Course summary', () => {
	test('counts the Lessons of each Topic and names the Classes that follow the Course', () => {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const other = createCourse(db, { name: 'Year 10 Chemistry' });
		const forces = makeTopic(db, course.id, 'Forces');
		const empty = makeTopic(db, course.id, 'Energy');
		makeLessons(db, forces.id, 3);
		createClass(db, { label: '9B/Ph1', courseId: course.id });
		createClass(db, { label: '9A/Ph1', courseId: course.id });
		createClass(db, { label: '10A/Ch1', courseId: other.id });

		const summary = courseSummary(db, course.id);
		expect(summary.lessonCounts.get(forces.id)).toBe(3);
		expect(summary.lessonCounts.get(empty.id) ?? 0).toBe(0);
		expect(summary.classes.map((c) => c.label)).toEqual(['9A/Ph1', '9B/Ph1']);
	});
});

describe('the Course tiles', () => {
	test('each Course carries its Topic, Lesson and Planned Lesson counts and its Classes', () => {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const bare = createCourse(db, { name: 'Year 10 Chemistry' });
		const forces = makeTopic(db, course.id, 'Forces');
		makeTopic(db, course.id, 'Energy');
		const [first] = makeLessons(db, forces.id, 3);
		editLesson(db, { id: first.id, change: { status: 'planned' }, today: '2026-09-03' });
		createClass(db, { label: '9B/Ph1', courseId: course.id });
		createClass(db, { label: '9A/Ph1', courseId: course.id });

		const tiles = courseTiles(db);
		expect(tiles.map((t) => t.name)).toEqual(['Year 10 Chemistry', 'Year 9 Physics']);
		expect(tiles.find((t) => t.id === bare.id)).toMatchObject({
			topicCount: 0,
			lessonCount: 0,
			plannedCount: 0,
			classes: []
		});
		expect(tiles.find((t) => t.id === course.id)).toMatchObject({
			topicCount: 2,
			lessonCount: 3,
			plannedCount: 1,
			classes: ['9A/Ph1', '9B/Ph1']
		});
	});
});

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

		const { lesson: first } = createLesson(db, {
			topicId: topic.id,
			title: 'Newton I'
		});
		const { lesson: second } = createLesson(db, {
			topicId: topic.id,
			title: 'Newton II'
		});

		expect(first.body).toBeNull();
		expect(first.length).toBe(1);
		expect(lessonsOf(db, topic.id)).toEqual([first, second]);

		const renamed = editLesson(db, {
			id: first.id,
			change: { title: 'Newton I — inertia' },
			today: '2026-09-03'
		})!.lesson;
		expect(lessonsOf(db, topic.id).map((l) => l.title)).toEqual([renamed.title, second.title]);
	});

	test('creating a Topic refuses a Course that is not there', () => {
		const { db } = setUpAuthoring();

		refused(
			() => createTopic(db, { courseId: 'does-not-exist', name: 'Forces' }),
			'missing',
			'Course not found.'
		);
		expect(db.select().from(schema.topic).all()).toEqual([]);
	});
});

describe('moving a Topic to another Course', () => {
	test('files the Topic and keeps Sequences, Readiness and dates', () => {
		const { db, course, classA, classB } = setUp();
		const other = createCourse(db, { name: 'Year 10 Physics' });
		const forces = makeTopic(db, course.id, 'Forces');
		const [lesson, second] = makeLessons(db, forces.id, 2);
		assignTopic(db, { classId: classA.id, topicId: forces.id, today: TODAY });
		setReadiness(db, lesson.id, classA.id, true);
		const before = {
			sequence: sequenceOf(db, classA.id),
			dates: datesOf(db, classA.id),
			datesB: datesOf(db, classB.id),
			readiness: db.select().from(schema.readiness).all()
		};

		const moved = moveTopicToCourse(db, { id: forces.id, courseId: other.id });

		expect(moved).toMatchObject({ id: forces.id, courseId: other.id });
		expect(topicsOf(db, other.id).map((t) => t.id)).toEqual([forces.id]);
		expect(lessonsOf(db, forces.id).map((l) => l.id)).toEqual([lesson.id, second.id]);
		expect(sequenceOf(db, classA.id)).toEqual(before.sequence);
		expect(datesOf(db, classA.id)).toEqual(before.dates);
		expect(datesOf(db, classB.id)).toEqual(before.datesB);
		expect(db.select().from(schema.readiness).all()).toEqual(before.readiness);
	});

	test('refuses a name clash in the target Course with the import message', () => {
		const { db, course } = setUp();
		const other = createCourse(db, { name: 'Year 10 Physics' });
		const forces = makeTopic(db, course.id, 'Forces');
		makeTopic(db, other.id, 'forces');

		refused(
			() => moveTopicToCourse(db, { id: forces.id, courseId: other.id }),
			'conflict',
			'The Course "Year 10 Physics" already holds a Topic called "forces".'
		);
		expect(topicsOf(db, course.id).map((t) => t.id)).toEqual([forces.id]);
	});

	test('answers undefined for an unknown Topic and refuses an unknown Course', () => {
		const { db, course } = setUp();
		const forces = makeTopic(db, course.id, 'Forces');

		expect(moveTopicToCourse(db, { id: 'nope', courseId: course.id })).toBeUndefined();
		refused(
			() => moveTopicToCourse(db, { id: forces.id, courseId: 'nope' }),
			'missing',
			'Course not found.'
		);
	});
});

// A Course/Topic with no children goes at once, same as a Lesson always has. One that still holds
// children asks first. Once confirmed, the delete Detaches: the Lessons become Standalone Lessons
// and every Sequence keeps them (ADR-0026). A Class that follows a Course blocks its delete.
describe('deleting a Course or a Topic', () => {
	test('an empty Course or Topic deletes at once, unconfirmed', () => {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });

		expect(deleteTopic(db, topic.id)).toMatchObject({ id: topic.id });
		expect(deleteCourse(db, course.id)).toMatchObject({ id: course.id });
		expect(listCourses(db)).toEqual([]);
	});

	test('a Topic that still holds Lessons asks first, then keeps them as Standalone Lessons', () => {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });
		const { lesson } = createLesson(db, { topicId: topic.id, title: 'Newton I' });

		expect(deleteTopic(db, topic.id)).toEqual({
			needsConfirm: true,
			reason:
				'Delete Forces? Its 1 Lesson becomes a Standalone Lesson. Every Class keeps it in its Sequence.'
		});
		expect(lessonsOf(db, topic.id)).toEqual([lesson]);

		expect(deleteTopic(db, topic.id, { confirmed: true })).toMatchObject({ id: topic.id });
		expect(topicsOf(db, course.id)).toEqual([]);
		expect(lessonDetail(db, lesson.id)).toMatchObject({ id: lesson.id, topicId: null });
	});

	test('a Course that still holds Topics asks first, then keeps every Lesson as a Standalone Lesson', () => {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });
		const { lesson } = createLesson(db, { topicId: topic.id, title: 'Newton I' });

		expect(deleteCourse(db, course.id)).toEqual({
			needsConfirm: true,
			reason:
				'Delete Year 9 Physics? Its 1 Topic goes. Its 1 Lesson becomes a Standalone Lesson. Every Class keeps it in its Sequence.'
		});
		expect(topicsOf(db, course.id)).toHaveLength(1);

		expect(deleteCourse(db, course.id, { confirmed: true })).toMatchObject({ id: course.id });
		expect(listCourses(db)).toEqual([]);
		expect(lessonDetail(db, lesson.id)).toMatchObject({ id: lesson.id, topicId: null });
	});

	test('deleting a Topic leaves every Sequence and date as it was', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const lessons = makeLessons(db, topic.id, 3);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: TODAY });
		const dates = datesOf(db, classA.id);

		deleteTopic(db, topic.id, { confirmed: true });

		expect(sequenceOf(db, classA.id)).toEqual(lessons.map((l) => l.id));
		expect(datesOf(db, classA.id)).toEqual(dates);
		expect(lessons.map((l) => lessonDetail(db, l.id)?.topicId)).toEqual([null, null, null]);
	});

	test('deleting a Course leaves every Sequence and date as it was', () => {
		const { db, classA } = setUp();
		const other = createCourse(db, { name: 'Year 10 Physics' });
		const topic = createTopic(db, { courseId: other.id, name: 'Waves' });
		const lessons = makeLessons(db, topic.id, 3);
		setSequence(
			db,
			classA.id,
			lessons.map((l) => l.id)
		);
		const dates = datesOf(db, classA.id);

		deleteCourse(db, other.id, { confirmed: true });

		expect(sequenceOf(db, classA.id)).toEqual(lessons.map((l) => l.id));
		expect(datesOf(db, classA.id)).toEqual(dates);
		expect(lessons.map((l) => lessonDetail(db, l.id)?.topicId)).toEqual([null, null, null]);
	});

	test('an unknown id returns undefined, the door answering its own 404', () => {
		const { db } = setUpAuthoring();

		expect(deleteTopic(db, 'does-not-exist')).toBeUndefined();
		expect(deleteCourse(db, 'does-not-exist')).toBeUndefined();
	});

	test('refuses a Course a Class follows, even confirmed', () => {
		const { db, course } = setUp();

		refused(
			() => deleteCourse(db, course.id, { confirmed: true }),
			'conflict',
			'A Class follows this Course, so it cannot be removed.'
		);
	});
});
