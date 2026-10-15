import { sql } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, refused, setUp, setUpAuthoring } from './fixtures';
import {
	assignTopic,
	classSchedule,
	createCourse,
	createLesson,
	createLink,
	createTopic,
	deleteLink,
	editLesson,
	lessonDetail,
	lessonsOf,
	linksOf,
	moveLink,
	placeLesson,
	renameTopic,
	setReadiness,
	updateLink
} from './index';
import { TODAY, datesOf, sequenceOf } from './authoring-fixtures';
import * as schema from '../db/schema';

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
