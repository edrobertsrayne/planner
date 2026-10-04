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
	listTagNames,
	topicsOf
} from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

// Any Lesson loads, including a Standalone one with no Topic: then `topic` and `course` are null.
export const load: PageServerLoad = ({ params }) => {
	const lesson = lessonDetail(db, params.id);
	if (!lesson) error(404, 'No such Lesson.');

	const [topic] = lesson.topicId
		? db.select().from(schema.topic).where(eq(schema.topic.id, lesson.topicId)).all()
		: [];
	const [course] = topic
		? db.select().from(schema.course).where(eq(schema.course.id, topic.courseId)).all()
		: [];

	return {
		lesson,
		course: course ?? null,
		topic: topic ?? null,
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
