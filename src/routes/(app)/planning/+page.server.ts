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
	listClasses,
	listTagNames,
	planningStream,
	topicsOf
} from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	// An unknown `class` id falls back to every Class rather than an error.
	const classes = listClasses(db);
	const classParam = url.searchParams.get('class');
	const classId = classes.find((c) => c.id === classParam)?.id;
	const stream = planningStream(db, today(), classId);

	const lessonId = url.searchParams.get('lesson');
	const detail = lessonId ? lessonDetail(db, lessonId) : null;
	const attachments = detail ? attachmentsOf(db, detail.id) : [];

	let course = null;
	let topic = null;
	let topics: ReturnType<typeof topicsOf> = [];
	let lessons: ReturnType<typeof lessonsOf> = [];
	let lessonIndex = -1;
	let taughtBy: ReturnType<typeof classesTaughtLesson> = [];

	if (detail && detail.topicId) {
		const [t] = db.select().from(schema.topic).where(eq(schema.topic.id, detail.topicId)).all();
		topic = t ?? null;
		if (topic) {
			const [c] = db.select().from(schema.course).where(eq(schema.course.id, topic.courseId)).all();
			course = c ?? null;
			topics = course ? topicsOf(db, course.id) : [];
			lessons = lessonsOf(db, topic.id);
			lessonIndex = lessons.findIndex((l) => l.id === detail.id);
		}
		taughtBy = classesTaughtLesson(db, { lessonId: detail.id, today: today() });
	}

	return {
		stream,
		classes,
		classId,
		lesson: detail,
		course,
		topic,
		topics,
		lessons,
		lessonIndex,
		links: detail?.links ?? [],
		tags: detail ? attachedTags(db, detail.id) : [],
		existingTagNames: detail ? listTagNames(db) : [],
		attachments,
		taughtBy
	};
};

export const actions: Actions = {
	...lessonActions
};
