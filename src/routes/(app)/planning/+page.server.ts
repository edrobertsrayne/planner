import { eq } from 'drizzle-orm';
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import * as schema from '$lib/server/db/schema';
import { lessonActions } from '$lib/server/lesson-actions';
import {
	classesTaughtLesson,
	lessonDetail,
	lessonsOf,
	planningStream,
	topicsOf
} from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const stream = planningStream(db, today());

	const lessonId = url.searchParams.get('lesson');
	const detail = lessonId ? lessonDetail(db, lessonId) : null;

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
		lesson: detail,
		course,
		topic,
		topics,
		lessons,
		lessonIndex,
		links: detail?.links ?? [],
		taughtBy
	};
};

export const actions: Actions = {
	...lessonActions
};
