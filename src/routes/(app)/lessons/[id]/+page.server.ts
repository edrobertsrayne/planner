import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import * as schema from '$lib/server/db/schema';
import { lessonActions } from '$lib/server/lesson-actions';
import {
	attachedTags,
	attachmentsOf,
	classesTaughtLesson,
	lessonDetail,
	lessonsOf,
	listTagNames,
	sequenceLessonIds,
	topicsOf
} from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

// Any Lesson loads, including a Standalone one with no Topic: then `topic` and `course` are null.
export const load: PageServerLoad = ({ params, url }) => {
	const lesson = lessonDetail(db, params.id);
	if (!lesson) error(404, 'No such Lesson.');

	const [topic] = lesson.topicId
		? db.select().from(schema.topic).where(eq(schema.topic.id, lesson.topicId)).all()
		: [];
	const [course] = topic
		? db.select().from(schema.course).where(eq(schema.course.id, topic.courseId)).all()
		: [];

	// With a Class in the URL the editor steps through that Class's Sequence; without one, or when
	// the Lesson is not in it, through the Topic's Lessons.
	const [cls] = db
		.select()
		.from(schema.classes)
		.where(eq(schema.classes.id, url.searchParams.get('class') ?? ''))
		.all();
	const sequence = cls ? sequenceLessonIds(db, cls.id) : [];
	const inSequence = sequence.includes(lesson.id);

	return {
		lesson,
		course: course ?? null,
		topic: topic ?? null,
		// The Class whose Sequence the editor steps through, or null for Topic order.
		stepClass: inSequence ? { id: cls.id, label: cls.label } : null,
		// The Lessons to step through, for "Lesson n of N". A Standalone Lesson reached without a Class
		// steps nowhere.
		siblingIds: inSequence
			? sequence
			: topic
				? lessonsOf(db, topic.id).map((l) => l.id)
				: [],
		topics: course ? topicsOf(db, course.id) : [],
		tags: attachedTags(db, lesson.id),
		existingTagNames: listTagNames(db),
		attachments: attachmentsOf(db, lesson.id),
		taughtBy: classesTaughtLesson(db, { lessonId: lesson.id, today: today() })
	};
};

export const actions: Actions = {
	...lessonActions
};
