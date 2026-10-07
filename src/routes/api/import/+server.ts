import { json } from '@sveltejs/kit';
import { client, db } from '$lib/server/db/client';
import { requireApiKey } from '$lib/server/api-key';
import { today } from '$lib/date';
import { refusalJson, stringField } from '$lib/server/api-helpers';
import { importTopic } from '$lib/server/planner/authoring';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const auth = await requireApiKey(event);
	if (auth) return auth;

	const data = await event.request.json();

	if (!data.course || typeof data.course !== 'object') {
		return json({ error: 'The "course" field is required.' }, { status: 400 });
	}

	if (!data.topic || typeof data.topic !== 'object') {
		return json({ error: 'The "topic" field is required.' }, { status: 400 });
	}

	const topicName = stringField(data.topic.name, 'name');
	if (topicName instanceof Response) return topicName;

	const lessons = Array.isArray(data.topic.lessons) ? data.topic.lessons : [];

	// Types only: every value rule — a title, a Length, a status, a Link's url — runs in the seam,
	// inside the one transaction.
	for (const lesson of lessons) {
		const title = stringField(lesson?.title, 'title');
		if (title instanceof Response) return title;
		if (lesson.body !== undefined && lesson.body !== null && typeof lesson.body !== 'string') {
			return json({ error: 'The "body" field must be a string or null.' }, { status: 400 });
		}
		if (lesson.length !== undefined && typeof lesson.length !== 'number') {
			return json({ error: 'The "length" field must be a number.' }, { status: 400 });
		}
		if (lesson.status !== undefined) {
			const status = stringField(lesson.status, 'status');
			if (status instanceof Response) return status;
		}
		if (!lesson.links) continue;
		if (!Array.isArray(lesson.links)) {
			return json({ error: 'The "links" field must be an array.' }, { status: 400 });
		}
		for (const link of lesson.links) {
			const url = stringField(link?.url, 'url');
			if (url instanceof Response) return url;
			const label = stringField(link?.label, 'label');
			if (label instanceof Response) return label;
		}
	}

	const courseId = typeof data.course.id === 'string' ? data.course.id : undefined;
	const courseName = typeof data.course.name === 'string' ? data.course.name : undefined;

	try {
		const created = importTopic(
			db,
			client,
			{
				courseId,
				courseName,
				topicName,
				lessons
			},
			today()
		);

		return json(
			{
				course: created.course,
				courseCreated: created.courseCreated,
				topic: created.topic,
				lessons: created.lessons,
				report: created.report
			},
			{ status: 201 }
		);
	} catch (error) {
		return refusalJson(error);
	}
};
