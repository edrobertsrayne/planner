import { describe, expect, test } from 'vitest';
import { refused, setUpAuthoring } from './fixtures';
import {
	createCourse,
	createLesson,
	importTopic,
	createTopic,
	lessonsOf,
	linksOf,
	listCourses,
	renameCourse,
	renameTopic,
	topicsOf
} from './index';
import * as schema from '../db/schema';

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
