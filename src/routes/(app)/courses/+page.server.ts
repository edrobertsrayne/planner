import { fail } from '@sveltejs/kit';
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { badRequest, conflict, trimmed } from '$lib/server/form';
import { lessonActions } from '$lib/server/lesson-actions';
import {
	attachedTags,
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
	NameCollision,
	renameCourse,
	renameLesson,
	renameTopic,
	tagsByLesson,
	topicsOf
} from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

// A name collision is the seam's only expected throw from the four authoring actions below; it
// carries a status the spec assigns meaning to (409 — issue #131 / §6.3 of planning-api.md). Any
// other throw is a 400 — the same shape the existing Lesson writes use, so the page renders it
// the same way.
function mapAuthoringError(error: unknown, fallback: string) {
	if (error instanceof NameCollision) return conflict(error, fallback);
	return badRequest(error, fallback);
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
		tags: detail ? attachedTags(db, detail.id) : [],
		existingTagNames: listTagNames(db),
		tagsByLesson: tagsByLesson(
			db,
			lessons.map((l) => l.id)
		),
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
			return mapAuthoringError(error, 'Could not create the Course.');
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
			return mapAuthoringError(error, 'Could not rename the Course.');
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
			return mapAuthoringError(error, 'Could not create the Topic.');
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
			return mapAuthoringError(error, 'Could not rename the Topic.');
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

	deleteLesson: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const result = deleteLesson(db, { id, today: today() });
		if (!result.ok) {
			if (result.reason === 'not found') return fail(404, { error: 'No such Lesson.' });
			return fail(409, { error: 'This Lesson has already been taught and cannot be deleted.' });
		}
		return {};
	},

	deleteCourse: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const confirmed = trimmed(data, 'confirmed') === 'true';
		const result = deleteCourse(db, id, { today: today(), confirmed });
		if (!result.ok) {
			if (result.reason === 'not found') return fail(404, { error: 'No such Course.' });
			return fail(409, { error: result.reason, needsConfirm: result.needsConfirm });
		}
		return {};
	},

	deleteTopic: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const confirmed = trimmed(data, 'confirmed') === 'true';
		const result = deleteTopic(db, id, { today: today(), confirmed });
		if (!result.ok) {
			if (result.reason === 'not found') return fail(404, { error: 'No such Topic.' });
			return fail(409, { error: result.reason, needsConfirm: result.needsConfirm });
		}
		return {};
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
