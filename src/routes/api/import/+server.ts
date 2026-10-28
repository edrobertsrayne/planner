import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import {
	ApiFailure,
	apiRoute,
	jsonObject,
	lessonFields,
	readJson,
	stringField
} from '$lib/server/api-helpers';
import { importTopic } from '$lib/server/planner';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = apiRoute(async (event) => {
	const data = await readJson(event.request);

	const course = jsonObject(data.course);
	if (!course) throw new ApiFailure(400, 'The "course" field is required.');

	const topic = jsonObject(data.topic);
	if (!topic) throw new ApiFailure(400, 'The "topic" field is required.');

	const topicName = stringField(topic.name, 'topic.name');

	// A present `lessons` is the caller's list; anything but an array is a mistake to report, not
	// an empty Topic to create.
	if (topic.lessons !== undefined && !Array.isArray(topic.lessons)) {
		throw new ApiFailure(400, 'The "lessons" field must be an array.');
	}

	// Types only: every value rule — a title, a Length, a status, a Link's url — runs in the seam,
	// inside the one transaction.
	const lessons: Array<{
		title: string;
		body?: string | null;
		length?: number;
		status?: string;
		links?: Array<{ url: string; label: string }>;
	}> = [];
	const lessonList: unknown[] = Array.isArray(topic.lessons) ? topic.lessons : [];
	for (const raw of lessonList) {
		const lesson = jsonObject(raw);
		if (!lesson) throw new ApiFailure(400, 'Each Lesson must be an object.');

		const fields = lessonFields(lesson);
		if (lesson.links !== undefined && !Array.isArray(lesson.links)) {
			throw new ApiFailure(400, 'The "links" field must be an array.');
		}

		const links: Array<{ url: string; label: string }> = [];
		const linkList: unknown[] = Array.isArray(lesson.links) ? lesson.links : [];
		for (const rawLink of linkList) {
			const link = jsonObject(rawLink);
			if (!link) throw new ApiFailure(400, 'Each Link must be an object.');

			links.push({ url: stringField(link.url, 'url'), label: stringField(link.label, 'label') });
		}

		// An absent title is an empty one, which the seam refuses: "A Lesson needs a title."
		lessons.push({ ...fields, title: fields.title ?? '', links });
	}

	const courseId = typeof course.id === 'string' ? course.id : undefined;
	const courseName = typeof course.name === 'string' ? course.name : undefined;

	// Exactly one of the two names the target Course. The seam's request type says so, so the
	// door turns the body into one shape or refuses it here.
	let target: { id: string } | { name: string };
	if (courseId !== undefined && courseName === undefined) target = { id: courseId };
	else if (courseName !== undefined && courseId === undefined) target = { name: courseName };
	else {
		throw new ApiFailure(400, 'The "course" field must carry exactly one of "id" or "name".');
	}

	const created = importTopic(db, { course: target, topicName, lessons });

	return json(
		{
			course: created.course,
			courseCreated: created.courseCreated,
			topic: created.topic,
			lessons: created.lessons,
			report: { placementsMoved: [] }
		},
		{ status: 201 }
	);
});
