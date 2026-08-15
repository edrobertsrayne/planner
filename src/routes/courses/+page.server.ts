import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	classesTaughtLesson,
	createCourse,
	createLesson,
	createLink,
	createTopic,
	deleteLesson,
	deleteLink,
	lessonDetail,
	lessonsOf,
	listCourses,
	moveLesson,
	moveLessonToTopic,
	moveLink,
	renameCourse,
	renameLesson,
	renameTopic,
	topicsOf,
	updateLesson,
	updateLink
} from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

// The scheduling boundary: content edits re-derive every affected Class from today, never before.
function today() {
	return new Date().toISOString().slice(0, 10);
}

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

function trimmed(data: FormData, field: string) {
	return String(data.get(field) ?? '').trim();
}

export const actions: Actions = {
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

	updateLesson: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const title = trimmed(data, 'title');
		if (!title) return fail(400, { error: 'A Lesson needs a title.' });
		const body = String(data.get('body') ?? '').trim() || null;
		const plannedLength = Math.max(1, Math.round(Number(data.get('plannedLength'))) || 1);
		const lesson = updateLesson(db, { id, title, body, plannedLength, today: today() });
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
			return fail(400, { error: error instanceof Error ? error.message : 'Could not delete.' });
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
	},

	moveLessonToTopic: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const topicId = trimmed(data, 'topicId');
		if (!topicId) return fail(400, { error: 'Pick a Topic.' });
		const lesson = moveLessonToTopic(db, { id, topicId, today: today() });
		if (!lesson) return fail(404, { error: 'No such Lesson.' });
		return { lesson };
	},

	createLink: async ({ request }) => {
		const data = await request.formData();
		const lessonId = trimmed(data, 'lessonId');
		const label = trimmed(data, 'label');
		const url = trimmed(data, 'url');
		if (!label) return fail(400, { error: 'A Link needs a label.' });
		if (!url) return fail(400, { error: 'A Link needs a url.' });
		return { link: createLink(db, { lessonId, label, url }) };
	},

	updateLink: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const label = trimmed(data, 'label');
		const url = trimmed(data, 'url');
		if (!label) return fail(400, { error: 'A Link needs a label.' });
		if (!url) return fail(400, { error: 'A Link needs a url.' });
		const link = updateLink(db, { id, label, url });
		if (!link) return fail(404, { error: 'No such Link.' });
		return { link };
	},

	deleteLink: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const link = deleteLink(db, { id });
		if (!link) return fail(404, { error: 'No such Link.' });
		return {};
	},

	moveLink: async ({ request }) => {
		const data = await request.formData();
		const lessonId = trimmed(data, 'lessonId');
		const id = trimmed(data, 'id');
		const direction = trimmed(data, 'direction');
		if (direction !== 'up' && direction !== 'down') return fail(400, { error: 'Bad direction.' });
		moveLink(db, { lessonId, id, direction });
		return {};
	}
};
