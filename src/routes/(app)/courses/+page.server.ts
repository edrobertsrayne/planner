import { fail } from '@sveltejs/kit';
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { badRequest, trimmed } from '$lib/server/form';
import { lessonActions } from '$lib/server/lesson-actions';
import {
	classesTaughtLesson,
	createCourse,
	createLesson,
	createTopic,
	deleteLesson,
	lessonDetail,
	lessonsOf,
	listCourses,
	moveLesson,
	renameCourse,
	renameLesson,
	renameTopic,
	topicsOf
} from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const courses = listCourses(db);

	const courseId = url.searchParams.get('course');
	const course = courseId ? (courses.find((c) => c.id === courseId) ?? null) : null;
	const topics = course ? topicsOf(db, course.id) : [];

	const topicId = url.searchParams.get('topic');
	const topic = topicId ? (topics.find((t) => t.id === topicId) ?? null) : null;
	const lessons = topic ? lessonsOf(db, topic.id) : [];

	const lessonId = url.searchParams.get('lesson');
	const detail =
		lessonId && lessons.some((l) => l.id === lessonId) ? lessonDetail(db, lessonId) : null;
	const lessonIndex = detail ? lessons.findIndex((l) => l.id === detail.id) : -1;
	const taughtBy = detail ? classesTaughtLesson(db, { lessonId: detail.id, today: today() }) : [];

	return {
		courses,
		course,
		topics,
		topic,
		lessons,
		lesson: detail,
		links: detail?.links ?? [],
		lessonIndex,
		taughtBy
	};
};

export const actions: Actions = {
	...lessonActions,

	createCourse: async ({ request }) => {
		const name = trimmed(await request.formData(), 'name');
		if (!name) return fail(400, { error: 'A Course needs a name.' });
		return { course: createCourse(db, { name }) };
	},

	renameCourse: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const name = trimmed(data, 'name');
		if (!name) return fail(400, { error: 'A Course needs a name.' });
		const course = renameCourse(db, { id, name });
		if (!course) return fail(404, { error: 'No such Course.' });
		return { course };
	},

	createTopic: async ({ request }) => {
		const data = await request.formData();
		const courseId = trimmed(data, 'courseId');
		const name = trimmed(data, 'name');
		if (!name) return fail(400, { error: 'A Topic needs a name.' });
		return { topic: createTopic(db, { courseId, name }) };
	},

	renameTopic: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const name = trimmed(data, 'name');
		if (!name) return fail(400, { error: 'A Topic needs a name.' });
		const topic = renameTopic(db, { id, name });
		if (!topic) return fail(404, { error: 'No such Topic.' });
		return { topic };
	},

	createLesson: async ({ request }) => {
		const data = await request.formData();
		const topicId = trimmed(data, 'topicId');
		const title = trimmed(data, 'title');
		if (!title) return fail(400, { error: 'A Lesson needs a title.' });
		return { lesson: createLesson(db, { topicId, title, today: today() }) };
	},

	renameLesson: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const title = trimmed(data, 'title');
		if (!title) return fail(400, { error: 'A Lesson needs a title.' });
		const lesson = renameLesson(db, { id, title });
		if (!lesson) return fail(404, { error: 'No such Lesson.' });
		return { lesson };
	},

	deleteLesson: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		try {
			const lesson = deleteLesson(db, { id, today: today() });
			if (!lesson) return fail(404, { error: 'No such Lesson.' });
			return {};
		} catch (error) {
			return badRequest(error, 'Could not delete.');
		}
	},

	moveLesson: async ({ request }) => {
		const data = await request.formData();
		const topicId = trimmed(data, 'topicId');
		const id = trimmed(data, 'id');
		const direction = trimmed(data, 'direction');
		if (direction !== 'up' && direction !== 'down') return fail(400, { error: 'Bad direction.' });
		moveLesson(db, { topicId, id, direction, today: today() });
		return {};
	}
};
