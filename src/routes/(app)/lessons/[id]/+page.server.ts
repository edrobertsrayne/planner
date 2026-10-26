import { error } from '@sveltejs/kit';
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { lessonActions } from '$lib/server/lesson-actions';
import {
	classDetail,
	classesTaughtLesson,
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

	return {
		lesson,
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
	...lessonActions
};
