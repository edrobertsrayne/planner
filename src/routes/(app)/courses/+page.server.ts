import { fail } from '@sveltejs/kit';
import { today } from '$lib/date';
import { DATABASE_URL, db } from '$lib/server/db/client';
import { refusal, trimmed } from '$lib/server/form';
import { lessonActions } from '$lib/server/lesson-actions';
import {
	attachmentsDir,
	createCourse,
	createLesson,
	createTopic,
	deleteCourse,
	deleteTopic,
	lessonsOf,
	listCourses,
	moveLesson,
	renameCourse,
	renameLesson,
	renameTopic,
	tagsByLesson,
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

	return {
		courses,
		course,
		topics,
		topic,
		lessons,
		tagsByLesson: tagsByLesson(
			db,
			lessons.map((l) => l.id)
		)
	};
};

export const actions: Actions = {
	...lessonActions,

	createCourse: async ({ request }) => {
		const name = String((await request.formData()).get('name') ?? '');
		try {
			return { course: createCourse(db, { name }) };
		} catch (error) {
			return refusal(error);
		}
	},

	renameCourse: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const name = String(data.get('name') ?? '');
		try {
			const course = renameCourse(db, { id, name });
			if (!course) return fail(404, { error: 'No such Course.' });
			return { course };
		} catch (error) {
			return refusal(error);
		}
	},

	createTopic: async ({ request }) => {
		const data = await request.formData();
		const courseId = trimmed(data, 'courseId');
		const name = String(data.get('name') ?? '');
		try {
			return { topic: createTopic(db, { courseId, name }) };
		} catch (error) {
			return refusal(error);
		}
	},

	renameTopic: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const name = String(data.get('name') ?? '');
		try {
			const topic = renameTopic(db, { id, name });
			if (!topic) return fail(404, { error: 'No such Topic.' });
			return { topic };
		} catch (error) {
			return refusal(error);
		}
	},

	createLesson: async ({ request }) => {
		const data = await request.formData();
		const topicId = trimmed(data, 'topicId');
		const title = String(data.get('title') ?? '');
		try {
			return { lesson: createLesson(db, { topicId, title, today: today() }) };
		} catch (error) {
			return refusal(error);
		}
	},

	renameLesson: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const title = String(data.get('title') ?? '');
		try {
			const lesson = renameLesson(db, { id, title });
			if (!lesson) return fail(404, { error: 'No such Lesson.' });
			return { lesson };
		} catch (error) {
			return refusal(error);
		}
	},

	deleteCourse: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const confirmed = trimmed(data, 'confirmed') === 'true';
		try {
			const result = deleteCourse(db, id, {
				today: today(),
				confirmed,
				dir: attachmentsDir(DATABASE_URL)
			});
			if (!result) return fail(404, { error: 'No such Course.' });
			// The confirm question is the one failure that is not a refusal: the form answers it
			// with `confirmed=true`, and the dialog opens on this flag.
			if ('needsConfirm' in result) return fail(409, { error: result.reason, needsConfirm: true });
			return {};
		} catch (error) {
			return refusal(error);
		}
	},

	deleteTopic: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const confirmed = trimmed(data, 'confirmed') === 'true';
		try {
			const result = deleteTopic(db, id, {
				today: today(),
				confirmed,
				dir: attachmentsDir(DATABASE_URL)
			});
			if (!result) return fail(404, { error: 'No such Topic.' });
			if ('needsConfirm' in result) return fail(409, { error: result.reason, needsConfirm: true });
			return {};
		} catch (error) {
			return refusal(error);
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
