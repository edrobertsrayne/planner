import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import {
	jsonObject,
	lessonFields,
	readJson,
	refusalJson,
	stringField
} from '$lib/server/api-helpers';
import { importTopic } from '$lib/server/planner';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const data = await readJson(event.request);
	if (data instanceof Response) return data;

	const course = jsonObject(data.course);
	if (!course) {
		return json({ error: 'The "course" field is required.' }, { status: 400 });
	}

	const topic = jsonObject(data.topic);
	if (!topic) {
		return json({ error: 'The "topic" field is required.' }, { status: 400 });
	}

	const topicName = stringField(topic.name, 'topic.name');
	if (topicName instanceof Response) return topicName;

	// A present `lessons` is the caller's list; anything but an array is a mistake to report, not
	// an empty Topic to create.
	if (topic.lessons !== undefined && !Array.isArray(topic.lessons)) {
		return json({ error: 'The "lessons" field must be an array.' }, { status: 400 });
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
		if (!lesson) return json({ error: 'Each Lesson must be an object.' }, { status: 400 });

		const fields = lessonFields(lesson);
		if (fields instanceof Response) return fields;
		if (lesson.links !== undefined && !Array.isArray(lesson.links)) {
			return json({ error: 'The "links" field must be an array.' }, { status: 400 });
		}

		const links: Array<{ url: string; label: string }> = [];
		const linkList: unknown[] = Array.isArray(lesson.links) ? lesson.links : [];
		for (const rawLink of linkList) {
			const link = jsonObject(rawLink);
			if (!link) return json({ error: 'Each Link must be an object.' }, { status: 400 });

			const url = stringField(link.url, 'url');
			if (url instanceof Response) return url;

			const label = stringField(link.label, 'label');
			if (label instanceof Response) return label;

			links.push({ url, label });
		}

		// An absent title is an empty one, which the seam refuses: "A Lesson needs a title."
		lessons.push({ ...fields, title: fields.title ?? '', links });
	}

	const courseId = typeof course.id === 'string' ? course.id : undefined;
	const courseName = typeof course.name === 'string' ? course.name : undefined;

	try {
		const created = importTopic(db, { courseId, courseName, topicName, lessons });

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
	} catch (error) {
		return refusalJson(error);
	}
};
