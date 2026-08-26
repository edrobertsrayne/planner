import { json } from '@sveltejs/kit';
import { client, db } from '$lib/server/db/client';
import { requireApiKey } from '$lib/server/api-key';
import { MAX_NAME_LENGTH, validateString, getDateToday } from '$lib/server/api-helpers';
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

	const topicName = validateString(data.topic.name, 'name', MAX_NAME_LENGTH);
	if (topicName instanceof Response) return topicName;

	const lessons = Array.isArray(data.topic.lessons) ? data.topic.lessons : [];

	for (const lesson of lessons) {
		if (!lesson.title || typeof lesson.title !== 'string' || lesson.title.trim().length === 0) {
			return json({ error: 'Every Lesson needs a title.' }, { status: 400 });
		}
		const trimmed = lesson.title.trim();
		if (trimmed.length > MAX_NAME_LENGTH) {
			return json(
				{ error: `The "title" field must be at most ${MAX_NAME_LENGTH} characters.` },
				{ status: 400 }
			);
		}
		if (lesson.links) {
			if (!Array.isArray(lesson.links)) {
				return json({ error: 'The "links" field must be an array.' }, { status: 400 });
			}
			for (const link of lesson.links) {
				if (!link.url || typeof link.url !== 'string' || link.url.trim().length === 0) {
					return json({ error: 'Every Link needs a url.' }, { status: 400 });
				}
				if (!link.label || typeof link.label !== 'string' || link.label.trim().length === 0) {
					return json({ error: 'Every Link needs a label.' }, { status: 400 });
				}
			}
		}
	}

	const courseId = typeof data.course.id === 'string' ? data.course.id : undefined;
	const courseName = typeof data.course.name === 'string' ? data.course.name : undefined;

	const today = getDateToday();

	const result = importTopic(
		db,
		client,
		{
			courseId,
			courseName,
			topicName,
			lessons
		},
		today
	);

	if (!result.ok) {
		return json({ error: result.error }, { status: result.status });
	}

	return json(
		{
			course: result.course,
			courseCreated: result.courseCreated,
			topic: result.topic,
			lessons: result.lessons
		},
		{ status: 201 }
	);
};
