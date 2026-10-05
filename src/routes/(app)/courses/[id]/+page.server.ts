import { error, fail, redirect } from '@sveltejs/kit';
import { today } from '$lib/date';
import { DATABASE_URL, db } from '$lib/server/db/client';
import { refusal, trimmed } from '$lib/server/form';
import {
	attachmentsDir,
	courseSummary,
	createLesson,
	createTopic,
	deleteCourse,
	deleteTopic,
	lessonsOf,
	listCourses,
	moveLesson,
	renameCourse,
	renameTopic,
	tagsByLesson,
	topicsOf
} from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, url }) => {
	const course = listCourses(db).find((c) => c.id === params.id);
	if (!course) error(404, 'No such Course.');

	const topics = topicsOf(db, course.id);
	const { lessonCounts, classes } = courseSummary(db, course.id);

	// `topic` is the one the address names. `shown` is the one the Lessons panel holds from `xl`
	// up, where the first Topic stands in when none is named.
	const topic = topics.find((t) => t.id === url.searchParams.get('topic')) ?? null;
	const shown = topic ?? topics[0] ?? null;
	const lessons = shown ? lessonsOf(db, shown.id) : [];

	return {
		course,
		topics: topics.map((t) => ({ ...t, lessonCount: lessonCounts.get(t.id) ?? 0 })),
		lessonTotal: [...lessonCounts.values()].reduce((sum, n) => sum + n, 0),
		classes,
		topic,
		shown,
		lessons,
		tagsByLesson: tagsByLesson(
			db,
			lessons.map((l) => l.id)
		)
	};
};

export const actions: Actions = {
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

	deleteCourse: async ({ request }) => {
		const id = trimmed(await request.formData(), 'id');
		try {
			const result = deleteCourse(db, id, {
				today: today(),
				confirmed: true,
				dir: attachmentsDir(DATABASE_URL)
			});
			if (!result) return fail(404, { error: 'No such Course.' });
		} catch (error) {
			return refusal(error);
		}
		redirect(303, '/courses');
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

	deleteTopic: async ({ request }) => {
		const id = trimmed(await request.formData(), 'id');
		try {
			const result = deleteTopic(db, id, {
				today: today(),
				confirmed: true,
				dir: attachmentsDir(DATABASE_URL)
			});
			if (!result) return fail(404, { error: 'No such Topic.' });
			return {};
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
