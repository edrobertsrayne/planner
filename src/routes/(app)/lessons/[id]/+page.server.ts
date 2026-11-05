import { error } from '@sveltejs/kit';
import { today } from '$lib/date';
import { DATABASE_URL, db } from '$lib/server/db/client';
import { lessonActions } from '$lib/server/lesson-actions';
import { formAction, trimmed } from '$lib/server/form';
import {
	classDetail,
	attachmentsDir,
	classesTaughtLesson,
	coverDetail,
	discardBlankCover,
	lessonDetail,
	lessonsOf,
	listCourses,
	listTagNames,
	sequenceLessonIds,
	topicsOf
} from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

// Any Lesson loads, including a Standalone one with no Topic: then `topic` and `course` are null.
export const load: PageServerLoad = ({ params, url }) => {
	const lesson = lessonDetail(db, params.id);
	if (!lesson) error(404, 'No such Lesson.');

	const { topic, course } = lesson;

	// With a Class in the URL the editor steps through that Class's Sequence; without one, or when
	// the Lesson is not in it, through the Topic's Lessons.
	const cls = classDetail(db, url.searchParams.get('class') ?? '');
	const sequence = cls ? sequenceLessonIds(db, cls.id) : [];
	const inSequence = sequence.includes(lesson.id);

	// Set cover opens a new Lesson here with its Cover in the address, so Back can take a blank one
	// back (ADR-0030). A Cover that names another Lesson, or none, is no banner.
	const cover = coverDetail(db, url.searchParams.get('cover') ?? '');

	return {
		lesson,
		cover: cover?.lessonId === lesson.id ? cover : null,
		// The Class whose Sequence the editor steps through, or null for Topic order.
		stepClass: inSequence ? { id: cls.id, label: cls.label } : null,
		// The Lessons to step through, for "Lesson n of N". A Standalone Lesson reached without a Class
		// steps nowhere.
		siblingIds: inSequence ? sequence : topic ? lessonsOf(db, topic.id).map((l) => l.id) : [],
		topics: course ? topicsOf(db, course.id) : [],
		// For a Standalone Lesson's Topic picker: every Topic, grouped by Course.
		topicChoices: topic
			? []
			: listCourses(db).map((c) => ({ id: c.id, course: c.name, topics: topicsOf(db, c.id) })),
		existingTagNames: listTagNames(db),
		taughtBy: classesTaughtLesson(db, { lessonId: lesson.id, today: today() })
	};
};

export const actions: Actions = {
	...lessonActions,

	// Back from a new Cover's Lesson: blank, it is taken back with its Cover; written, it stays.
	discardCover: formAction((data) => ({
		discarded: discardBlankCover(db, {
			coverId: trimmed(data, 'coverId'),
			dir: attachmentsDir(DATABASE_URL),
			today: today()
		})
	}))
};
