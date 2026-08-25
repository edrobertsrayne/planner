import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import * as schema from '$lib/server/db/schema';
import { trimmed } from '$lib/server/form';
import {
	classesTaughtLesson,
	createLink,
	deleteLink,
	lessonDetail,
	lessonsOf,
	moveLessonToTopic,
	moveLink,
	planningStream,
	setLessonStatus,
	topicsOf,
	updateLesson,
	updateLink
} from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

function isHttpUrl(url: string) {
	try {
		return ['http:', 'https:'].includes(new URL(url).protocol);
	} catch {
		return false;
	}
}

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

	if (detail) {
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
	setLessonStatus: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const status = trimmed(data, 'status');
		if (status !== 'draft' && status !== 'planned') {
			return fail(400, { error: 'Bad status.' });
		}
		const lesson = setLessonStatus(db, id, status);
		if (!lesson) return fail(404, { error: 'No such Lesson.' });
		return { lesson };
	},

	updateLesson: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const title = trimmed(data, 'title');
		if (!title) return fail(400, { error: 'A Lesson needs a title.' });
		const body = String(data.get('body') ?? '').trim() || null;
		const length = Math.max(1, Math.round(Number(data.get('length'))) || 1);
		const lesson = updateLesson(db, { id, title, body, length, today: today() });
		if (!lesson) return fail(404, { error: 'No such Lesson.' });
		return { lesson };
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
		if (!isHttpUrl(url)) return fail(400, { error: 'A Link must be an http(s) URL.' });
		return { link: createLink(db, { lessonId, label, url }) };
	},

	updateLink: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const label = trimmed(data, 'label');
		const url = trimmed(data, 'url');
		if (!label) return fail(400, { error: 'A Link needs a label.' });
		if (!url) return fail(400, { error: 'A Link needs a url.' });
		if (!isHttpUrl(url)) return fail(400, { error: 'A Link must be an http(s) URL.' });
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
