import { fail } from '@sveltejs/kit';
import { today } from '$lib/date';
import { DATABASE_URL, db } from '$lib/server/db/client';
import { refusal, trimmed } from '$lib/server/form';
import { lessonActions } from '$lib/server/lesson-actions';
import {
	attachedTags,
	attachmentsDir,
	attachmentsOf,
	classesTaughtLesson,
	createCourse,
	createLesson,
	createTopic,
	deleteCourse,
	deleteLesson,
	deleteTopic,
	lessonDetail,
	lessonsOf,
	listCourses,
	listTagNames,
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

	const lessonId = url.searchParams.get('lesson');
	const detail =
		lessonId && lessons.some((l) => l.id === lessonId) ? lessonDetail(db, lessonId) : null;
	const attachments = detail ? attachmentsOf(db, detail.id) : [];
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
		tags: detail ? attachedTags(db, detail.id) : [],
		existingTagNames: detail ? listTagNames(db) : [],
		tagsByLesson: tagsByLesson(
			db,
			lessons.map((l) => l.id)
		),
		attachments,
		lessonIndex,
		taughtBy
	};
};

export const actions: Actions = {
	...lessonActions,

	createCourse: async ({ request }) => {
		const name = trimmed(await request.formData(), 'name');
		if (!name) return fail(400, { error: 'A Course needs a name.' });
		try {
			return { course: createCourse(db, { name }) };
		} catch (error) {
			return refusal(error);
		}
	},

	renameCourse: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const name = trimmed(data, 'name');
		if (!name) return fail(400, { error: 'A Course needs a name.' });
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
		const name = trimmed(data, 'name');
		if (!name) return fail(400, { error: 'A Topic needs a name.' });
		try {
			return { topic: createTopic(db, { courseId, name }) };
		} catch (error) {
			return refusal(error);
		}
	},

	renameTopic: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const name = trimmed(data, 'name');
		if (!name) return fail(400, { error: 'A Topic needs a name.' });
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

	// The seam now writes the reason: a Lesson a Class has already been taught refuses with the
	// Detach hint, and one a Placement names with the Placement way out — so the action shows the
	// real reason instead of one fixed "already been taught" line for both (issue: the courses
	// form's deleteLesson mislabeled a placed Lesson as taught).
	deleteLesson: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		try {
			const lesson = deleteLesson(db, { id, today: today(), dir: attachmentsDir(DATABASE_URL) });
			if (!lesson) return fail(404, { error: 'No such Lesson.' });
			return {};
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
