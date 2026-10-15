import { asc, eq, sql } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, refused, setSequence, setUp, setUpAuthoring } from './fixtures';
import {
	assignTopic,
	attachTag,
	classSchedule,
	classesTaughtLesson,
	createClass,
	createCourse,
	createLesson,
	createLink,
	courseSummary,
	courseTiles,
	createTopic,
	deleteCourse,
	deleteLesson,
	deleteLink,
	deleteTopic,
	detachTag,
	editLesson,
	importTopic,
	lessonDetail,
	lessonsOf,
	linksOf,
	listCourses,
	listTagNames,
	moveLesson,
	moveLink,
	moveTopicToCourse,
	placeLesson,
	renameCourse,
	renameTopic,
	setReadiness,
	tagsByLesson,
	tagsOf,
	topicsOf,
	updateLink
} from './index';
import * as schema from '../db/schema';
import { TONE_SEQUENCE } from '$lib/class-tone';
import type { Db } from './derive';

const TODAY = '2026-09-03';

// The Lessons a Class's Sequence holds, in teaching order.
const sequenceOf = (db: Db, classId: string) =>
	db
		.select()
		.from(schema.classLesson)
		.where(eq(schema.classLesson.classId, classId))
		.orderBy(asc(schema.classLesson.position))
		.all()
		.map((row) => row.lessonId);

// Which Lesson a Class teaches on which date and Period, from TODAY.
const datesOf = (db: Db, classId: string) =>
	classSchedule(db, { classId, today: TODAY }).scheduled.map(
		(s) => `${s.date}|${s.period}|${s.lessonId}`
	);

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
		const { db, client } = setUpAuthoring();
		createCourse(db, { name: 'Year 9 Physics' });
		const { course } = importTopic(db, client, {
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
});

// Course names are globally unique; Topic names are unique within their Course (issue #131).
// The seam refuses the write with a readable message — the database indexes are the guard of last
// resort, not the user-facing one. Matching is case-insensitive, and stored values are trimmed at
// write time, so "Forces" and "forces" and "  Forces  " all collide.
describe('name collisions', () => {
	test('creating a Course whose name duplicates another refuses as a conflict', () => {
		const { db } = setUpAuthoring();
		createCourse(db, { name: 'Year 9 Physics' });

		expect(() => createCourse(db, { name: 'Year 10 Physics' })).not.toThrow();
		refused(
			() => createCourse(db, { name: 'Year 9 Physics' }),
			'conflict',
			'A Course called "Year 9 Physics" already exists.'
		);
		refused(
			() => createCourse(db, { name: 'YEAR 9 PHYSICS' }),
			'conflict',
			'A Course called "Year 9 Physics" already exists.'
		);
		refused(
			() => createCourse(db, { name: '  Year 9 Physics  ' }),
			'conflict',
			'A Course called "Year 9 Physics" already exists.'
		);

		// No row landed from any of the refused attempts.
		expect(listCourses(db)).toHaveLength(2);
	});

	test('renaming a Course to a name in use refuses as a conflict', () => {
		const { db } = setUpAuthoring();
		const a = createCourse(db, { name: 'Year 9 Physics' });
		const b = createCourse(db, { name: 'Year 10 Physics' });

		refused(
			() => renameCourse(db, { id: b.id, name: 'Year 9 Physics' }),
			'conflict',
			'A Course called "Year 9 Physics" already exists.'
		);
		refused(
			() => renameCourse(db, { id: b.id, name: 'year 9 physics' }),
			'conflict',
			'A Course called "Year 9 Physics" already exists.'
		);

		// A rename to its own name is not a collision — the seam excludes the row being renamed.
		expect(() => renameCourse(db, { id: a.id, name: 'Year 9 Physics' })).not.toThrow();
		expect(() => renameCourse(db, { id: a.id, name: 'YEAR 9 PHYSICS' })).not.toThrow();
	});

	test('creating a Topic whose name duplicates one in the same Course refuses as a conflict', () => {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const other = createCourse(db, { name: 'Year 10 Physics' });

		createTopic(db, { courseId: course.id, name: 'Forces' });

		// Same Course, same name (any case): refused.
		refused(
			() => createTopic(db, { courseId: course.id, name: 'Forces' }),
			'conflict',
			'The Course "Year 9 Physics" already holds a Topic called "Forces".'
		);
		refused(
			() => createTopic(db, { courseId: course.id, name: 'forces' }),
			'conflict',
			'The Course "Year 9 Physics" already holds a Topic called "Forces".'
		);

		// Different Course, same name: accepted.
		expect(() => createTopic(db, { courseId: other.id, name: 'Forces' })).not.toThrow();

		expect(topicsOf(db, course.id)).toHaveLength(1);
	});

	test('renaming a Topic to a name used in the same Course refuses as a conflict', () => {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const forces = createTopic(db, { courseId: course.id, name: 'Forces' });
		const waves = createTopic(db, { courseId: course.id, name: 'Waves' });

		refused(
			() => renameTopic(db, { id: waves.id, name: 'Forces' }),
			'conflict',
			'The Course "Year 9 Physics" already holds a Topic called "Forces".'
		);
		refused(
			() => renameTopic(db, { id: waves.id, name: 'FORCES' }),
			'conflict',
			'The Course "Year 9 Physics" already holds a Topic called "Forces".'
		);

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

		expect(() => createLesson(db, { topicId: topic.id, title: 'Revision' })).not.toThrow();
		expect(() => createLesson(db, { topicId: topic.id, title: 'Revision' })).not.toThrow();

		expect(lessonsOf(db, topic.id).map((l) => l.title)).toEqual(['Revision', 'Revision']);
	});

	test('the database index refuses a write that bypasses the seam', () => {
		const { db } = setUpAuthoring();
		createCourse(db, { name: 'Year 9 Physics' });

		// Raw insert — the application's collision check is skipped.
		expect(() =>
			db.insert(schema.course).values({ id: 'bypass', name: 'YEAR 9 PHYSICS' }).run()
		).toThrow(/Failed query: insert into "course"/);
	});
});

// Import creates one Topic with its Lessons and Links in a single all-or-nothing transaction
// (issue #139). It targets a Course by existing id or by name, creating the Course inline when
// the name is new.
describe('importing a Topic with its Lessons and Links', () => {
	test('creates a new Course, its Topic, Lessons and Links in one call', () => {
		const { db, client } = setUpAuthoring();

		const result = importTopic(db, client, {
			courseName: 'Year 9 Physics',
			topicName: 'Forces',
			lessons: [
				{
					title: 'Newton I',
					links: [{ url: 'https://example.com/a', label: 'Reading' }]
				},
				{ title: 'Newton II' }
			]
		});

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

		const result = importTopic(db, client, {
			courseId: course.id,
			topicName: 'Waves',
			lessons: [{ title: 'Reflection' }]
		});

		expect(result.courseCreated).toBe(false);
		expect(result.course.id).toBe(course.id);
		expect(listCourses(db)).toHaveLength(1);
	});

	test('refuses when the course field carries both id and name, or neither', () => {
		const { db, client } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });

		refused(
			() =>
				importTopic(db, client, {
					courseId: course.id,
					courseName: 'Year 9 Physics',
					topicName: 'Waves',
					lessons: []
				}),
			'invalid',
			'The "course" field must carry exactly one of "id" or "name".'
		);

		refused(
			() => importTopic(db, client, { topicName: 'Waves', lessons: [] }),
			'invalid',
			'The "course" field must carry exactly one of "id" or "name".'
		);

		expect(topicsOf(db, course.id)).toHaveLength(0);
	});

	test('refuses a Topic name that collides in the target Course, creating nothing', () => {
		const { db, client } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		createTopic(db, { courseId: course.id, name: 'Forces' });

		refused(
			() =>
				importTopic(db, client, {
					courseId: course.id,
					topicName: 'forces',
					lessons: [{ title: 'Newton I' }]
				}),
			'conflict',
			'The Course "Year 9 Physics" already holds a Topic called "Forces".'
		);
		expect(topicsOf(db, course.id)).toHaveLength(1);
		expect(lessonsOf(db, topicsOf(db, course.id)[0].id)).toHaveLength(0);
	});

	test('a refused field partway through leaves no Course, Topic, Lesson or Link behind', () => {
		const { db, client } = setUpAuthoring();

		// The second Lesson's Link is a `javascript:` url — refused inside the transaction, after
		// the Course, the Topic and the first Lesson were already written, so all of it rolls back.
		refused(
			() =>
				importTopic(db, client, {
					courseName: 'Year 9 Physics',
					topicName: 'Forces',
					lessons: [
						{ title: 'Newton I', links: [{ url: 'https://example.com/a', label: 'Sheet' }] },
						{ title: 'Newton II', links: [{ url: 'javascript:alert(1)', label: 'Trap' }] }
					]
				}),
			'invalid',
			'A Link must be an http(s) URL.'
		);
		expect(listCourses(db)).toHaveLength(0);
	});

	test.each([
		[{ title: 'Newton I', length: 0 }, 'A Length must be a whole number of Periods from 1 to 20.'],
		[{ title: 'Newton I', length: 21 }, 'A Length must be a whole number of Periods from 1 to 20.'],
		[
			{ title: 'Newton I', length: 1.5 },
			'A Length must be a whole number of Periods from 1 to 20.'
		],
		[{ title: 'Newton I', status: 'archived' }, 'A Lesson must be Draft or Planned.'],
		[{ title: '   ' }, 'A Lesson needs a title.']
	])('refuses a Lesson the one-at-a-time writers refuse: %o', (lesson, message) => {
		const { db, client } = setUpAuthoring();
		refused(
			() =>
				importTopic(db, client, {
					courseName: 'Year 9 Physics',
					topicName: 'Forces',
					lessons: [lesson]
				}),
			'invalid',
			message
		);
		expect(listCourses(db)).toHaveLength(0);
	});
});

// The value rules live in the seam (ADR-0025), so every door — form, API, Session panel — refuses
// the same input with the same message.
describe('field rules', () => {
	test('a name, title or label that is empty after trimming is refused', () => {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });
		const { lesson } = createLesson(db, {
			topicId: topic.id,
			title: 'Newton I'
		});

		refused(() => createCourse(db, { name: '  ' }), 'invalid', 'A Course needs a name.');
		refused(() => renameTopic(db, { id: topic.id, name: '' }), 'invalid', 'A Topic needs a name.');
		refused(
			() => editLesson(db, { id: lesson.id, change: { title: ' \n ' }, today: '2026-09-03' }),
			'invalid',
			'A Lesson needs a title.'
		);
		refused(
			() => createLink(db, { lessonId: lesson.id, url: 'https://example.com', label: ' ' }),
			'invalid',
			'A Link needs a label.'
		);
		refused(
			() => createLink(db, { lessonId: lesson.id, url: '', label: 'Sheet' }),
			'invalid',
			'A Link needs a url.'
		);
	});

	test("a Link's url must be http(s), so no other scheme ever reaches an href", () => {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });
		const { lesson } = createLesson(db, {
			topicId: topic.id,
			title: 'Newton I'
		});
		const link = createLink(db, { lessonId: lesson.id, url: 'https://example.com', label: 'A' });

		for (const url of ['javascript:alert(1)', 'ftp://example.com/file', 'not a url']) {
			refused(
				() => updateLink(db, { id: link.id, url, label: 'A' }),
				'invalid',
				'A Link must be an http(s) URL.'
			);
		}
		expect(linksOf(db, lesson.id)[0].url).toBe('https://example.com');
	});

	test('names, titles, labels and urls are stored trimmed; a plan is stored as typed unless blank', () => {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: '  Year 9 Physics ' });
		const topic = createTopic(db, { courseId: course.id, name: ' Forces ' });
		const { lesson } = createLesson(db, {
			topicId: topic.id,
			title: ' Newton I ',
			body: '  - indented list\n'
		});
		const link = createLink(db, {
			lessonId: lesson.id,
			url: ' https://example.com ',
			label: ' Sheet '
		});

		expect([course.name, topic.name, lesson.title, link.label, link.url]).toEqual([
			'Year 9 Physics',
			'Forces',
			'Newton I',
			'Sheet',
			'https://example.com'
		]);
		expect(lesson.body).toBe('  - indented list\n');

		const blanked = editLesson(db, {
			id: lesson.id,
			change: { body: ' \n ' },
			today: '2026-09-03'
		});
		expect(blanked?.lesson.body).toBeNull();
	});

	test('a Length outside 1 to 20 Periods and an unknown status are refused at every writer', () => {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });
		const { lesson } = createLesson(db, {
			topicId: topic.id,
			title: 'Newton I'
		});
		const lengthRule = 'A Length must be a whole number of Periods from 1 to 20.';

		refused(
			() =>
				editLesson(db, {
					id: lesson.id,
					change: { title: 'Newton I', body: null, length: Number.NaN },
					today: '2026-09-03'
				}),
			'invalid',
			lengthRule
		);
		refused(
			() => editLesson(db, { id: lesson.id, change: { length: 21 }, today: '2026-09-03' }),
			'invalid',
			lengthRule
		);
		refused(
			() => editLesson(db, { id: lesson.id, change: { status: 'archived' }, today: '2026-09-03' }),
			'invalid',
			'A Lesson must be Draft or Planned.'
		);
		expect(lessonDetail(db, lesson.id)).toMatchObject({ length: 1, status: 'draft' });
	});
});

describe("a Lesson's planning status", () => {
	function setUpLesson() {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });
		const { lesson } = createLesson(db, {
			topicId: topic.id,
			title: 'Newton I'
		});
		return { db, topic, lesson };
	}

	test('a new Lesson is Draft, and can be set to Planned and back', () => {
		const { db, lesson } = setUpLesson();

		expect(lesson.status).toBe('draft');
		expect(lessonDetail(db, lesson.id)!.status).toBe('draft');

		const planned = editLesson(db, {
			id: lesson.id,
			change: { status: 'planned' },
			today: '2026-09-03'
		});
		expect(planned?.lesson.status).toBe('planned');
		expect(lessonDetail(db, lesson.id)!.status).toBe('planned');

		const draft = editLesson(db, {
			id: lesson.id,
			change: { status: 'draft' },
			today: '2026-09-03'
		});
		expect(draft?.lesson.status).toBe('draft');
		expect(lessonDetail(db, lesson.id)!.status).toBe('draft');
	});

	test("setting a Lesson's planning status moves no date", () => {
		const { db, course, classA } = setUp();
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });
		const { lesson } = createLesson(db, {
			topicId: topic.id,
			title: 'Newton I'
		});
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const before = classSchedule(db, { classId: classA.id, today: '2026-09-03' });
		expect(before.scheduled.length).toBeGreaterThan(0);
		expect(before.scheduled[0].lessonId).toBe(lesson.id);

		editLesson(db, { id: lesson.id, change: { status: 'planned' }, today: '2026-09-03' });
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
		).toThrow(/Failed query: INSERT INTO lesson/);
	});
});

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
		const { db, client, classA, atDir: dir } = setUp();
		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3)!;

		const placed = placeLesson(db, client, {
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

// One Lesson edit owns every rule for a change to one Lesson, so the Lesson editor and the API
// give the same answer to the same change (issue #356).
describe('one Lesson edit', () => {
	function placeStandalone(
		db: ReturnType<typeof setUp>['db'],
		client: ReturnType<typeof setUp>['client'],
		classId: string
	) {
		const mondaySlot = db
			.select()
			.from(schema.slot)
			.all()
			.find((s) => s.classId === classId && s.week === 'A' && s.day === 1 && s.period === 3)!;
		return placeLesson(db, client, {
			classId,
			date: '2026-09-14',
			slotId: mondaySlot.id,
			title: 'Assembly',
			today: '2026-09-03'
		}).lesson;
	}

	test('an unknown Topic is missing, from a Standalone Lesson and from a Topic Lesson alike', () => {
		const { db, client, course, classA } = setUp();
		const placed = placeStandalone(db, client, classA.id);
		const [inTopic] = makeLessons(db, makeTopic(db, course.id, 'Forces').id, 1);

		for (const id of [placed.id, inTopic.id]) {
			refused(
				() => editLesson(db, { id, change: { topicId: 'does-not-exist' }, today: '2026-09-03' }),
				'missing',
				'Topic not found.'
			);
		}
	});

	test('a change that sets nothing returns the Lesson unchanged and an empty report', () => {
		const { db, client, course, classA } = setUp();
		const placed = placeStandalone(db, client, classA.id);
		const topic = makeTopic(db, course.id, 'Forces');
		const [inTopic] = makeLessons(db, topic.id, 1);
		const empty = { placementsMoved: [] };

		expect(editLesson(db, { id: inTopic.id, change: {}, today: '2026-09-03' })).toEqual({
			lesson: inTopic,
			...empty
		});
		expect(
			editLesson(db, {
				id: inTopic.id,
				change: { topicId: topic.id, title: inTopic.title },
				today: '2026-09-03'
			})
		).toEqual({ lesson: inTopic, ...empty });
		expect(
			editLesson(db, { id: placed.id, change: { topicId: null }, today: '2026-09-03' })
		).toEqual({ lesson: placed, ...empty });
	});

	// Filing a Lesson never changes a Sequence, a date or a mark (ADR-0026).
	function setUpFiling() {
		const { db, client, course, classA, classB } = setUp();
		const forces = makeTopic(db, course.id, 'Forces');
		const waves = makeTopic(db, course.id, 'Waves');
		const [moved, detached] = makeLessons(db, forces.id, 2);
		assignTopic(db, { classId: classA.id, topicId: forces.id, today: TODAY });
		assignTopic(db, { classId: classB.id, topicId: forces.id, today: TODAY });
		for (const lesson of [moved, detached]) {
			setReadiness(db, lesson.id, classA.id, true);
			setReadiness(db, lesson.id, classB.id, true);
		}
		const snapshot = () => ({
			sequenceA: sequenceOf(db, classA.id),
			sequenceB: sequenceOf(db, classB.id),
			datesA: datesOf(db, classA.id),
			datesB: datesOf(db, classB.id),
			readiness: db.select().from(schema.readiness).all().length
		});
		return { db, client, classA, forces, waves, moved, detached, snapshot };
	}

	test('filing a Lesson in another Topic changes no Sequence, no date and no Readiness', () => {
		const { db, waves, moved, snapshot } = setUpFiling();
		const before = snapshot();

		const result = editLesson(db, { id: moved.id, change: { topicId: waves.id }, today: TODAY });

		expect(result).toMatchObject({ lesson: { topicId: waves.id }, placementsMoved: [] });
		expect(snapshot()).toEqual(before);
		expect(before.readiness).toBe(4);
	});

	test('a Detach changes no Sequence, no date and no Readiness', () => {
		const { db, detached, snapshot } = setUpFiling();
		const before = snapshot();

		const result = editLesson(db, { id: detached.id, change: { topicId: null }, today: TODAY });

		expect(result).toMatchObject({ lesson: { topicId: null }, placementsMoved: [] });
		expect(snapshot()).toEqual(before);
	});

	test('a Standalone Lesson takes a Topic and keeps its Placement and Readiness', () => {
		const { db, client, course, classA } = setUp();
		const placed = placeStandalone(db, client, classA.id);
		setReadiness(db, placed.id, classA.id, true);
		const topic = makeTopic(db, course.id, 'Forces');
		const datesBefore = datesOf(db, classA.id);

		const result = editLesson(db, { id: placed.id, change: { topicId: topic.id }, today: TODAY });

		expect(result).toMatchObject({ lesson: { topicId: topic.id }, placementsMoved: [] });
		expect(lessonsOf(db, topic.id).map((l) => l.id)).toEqual([placed.id]);
		expect(datesOf(db, classA.id)).toEqual(datesBefore);
		expect(db.select().from(schema.placement).all()).toMatchObject([{ lessonId: placed.id }]);
		expect(db.select().from(schema.readiness).all()).toMatchObject([{ lessonId: placed.id }]);
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
		const { db, client, classA, classB } = setUp();
		const today = '2026-09-03';
		const slots = db.select().from(schema.slot).all();
		const classAMonday = slots.find(
			(s) => s.classId === classA.id && s.week === 'A' && s.day === 1 && s.period === 3
		)!;
		const classBMonday = slots.find(
			(s) => s.classId === classB.id && s.week === 'A' && s.day === 1 && s.period === 1
		)!;

		const placed = placeLesson(db, client, {
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

describe('the Lesson editor', () => {
	function setUpLesson() {
		const { db } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });
		const { lesson } = createLesson(db, {
			topicId: topic.id,
			title: 'Newton I'
		});
		return { db, topic, lesson };
	}

	test('reads a Lesson back with its Links, in position order', () => {
		const { db, lesson } = setUpLesson();

		expect(lessonDetail(db, lesson.id)).toEqual({ ...lesson, links: [], tags: [] });
	});

	test('a Lesson holds a markdown body and a Length in Periods', () => {
		const { db, lesson } = setUpLesson();

		const updated = editLesson(db, {
			id: lesson.id,
			change: { title: 'Newton I — inertia', body: 'Objectives: state the First Law.', length: 2 },
			today: '2026-09-03'
		});

		expect(updated?.lesson).toMatchObject({
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
		const { db, atDir: dir } = setUpAuthoring();
		const course = createCourse(db, { name: 'Year 9 Physics' });
		const topic = createTopic(db, { courseId: course.id, name: 'Forces' });
		const { lesson } = createLesson(db, {
			topicId: topic.id,
			title: 'Newton I'
		});
		return { db, topic, lesson, dir };
	}

	test('attaching a name that matches an existing Tag reuses it, trimmed and case-insensitive', () => {
		const { db, lesson } = setUpLesson();

		expect(attachTag(db, { lessonId: lesson.id, name: 'Practical' })).toEqual(['Practical']);

		const { lesson: other } = createLesson(db, {
			topicId: lesson.topicId!,
			title: 'Newton II'
		});
		expect(attachTag(db, { lessonId: other.id, name: '  practical  ' })).toEqual(['Practical']);

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

	test('an empty or whitespace-only name is refused as invalid', () => {
		const { db, lesson } = setUpLesson();

		refused(
			() => attachTag(db, { lessonId: lesson.id, name: '   ' }),
			'invalid',
			'A Tag needs a name.'
		);
		expect(tagsOf(db, lesson.id)).toEqual([]);
	});

	test('detaching removes only the one lesson_tag row, leaving the Tag and other attachments', () => {
		const { db, lesson } = setUpLesson();
		const { lesson: other } = createLesson(db, {
			topicId: lesson.topicId!,
			title: 'Newton II'
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
		const { db, lesson, dir } = setUpLesson();
		attachTag(db, { lessonId: lesson.id, name: 'Practical' });

		deleteLesson(db, { id: lesson.id, today: '2026-09-03', dir });

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
		const { lesson: other } = createLesson(db, {
			topicId: lesson.topicId!,
			title: 'Newton II'
		});
		const { lesson: untagged } = createLesson(db, {
			topicId: lesson.topicId!,
			title: 'Newton III'
		});

		attachTag(db, { lessonId: lesson.id, name: 'Practical' });
		attachTag(db, { lessonId: other.id, name: 'Trip' });

		const batch = tagsByLesson(db, [lesson.id, other.id, untagged.id]);
		expect(batch.get(lesson.id)).toEqual(['Practical']);
		expect(batch.get(other.id)).toEqual(['Trip']);
		expect(batch.get(untagged.id)).toBeUndefined();
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
