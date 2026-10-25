import { describe, expect, test } from 'vitest';
import { refused, setUpAuthoring } from './fixtures';
import {
	attachTag,
	createCourse,
	createLesson,
	createTopic,
	deleteLesson,
	detachTag,
	lessonDetail,
	listTagNames,
	tagsByLesson,
	tagsOf
} from './index';
import * as schema from '../db/schema';

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
