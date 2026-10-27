import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { formAction, found, trimmed } from '$lib/server/form';
import {
	courseSummary,
	createLesson,
	createTopic,
	deleteCourse,
	deleteTopic,
	lessonsOf,
	listCourses,
	moveLesson,
	moveTopicToCourse,
	renameCourse,
	renameTopic,
	tagsByLesson,
	topicsOf,
	Refused
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
		otherCourses: listCourses(db).filter((c) => c.id !== course.id),
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
	renameCourse: formAction((data) => ({
		course: found(
			renameCourse(db, { id: trimmed(data, 'id'), name: String(data.get('name') ?? '') }),
			'Course'
		)
	})),

	// An empty Course goes at once; one that still holds Topics throws `unconfirmed`, which the
	// dialog asks again with `confirmed`.
	deleteCourse: formAction((data) => {
		found(
			deleteCourse(db, trimmed(data, 'id'), {
				confirmed: trimmed(data, 'confirmed') === 'true'
			}),
			'Course'
		);
		redirect(303, '/courses');
	}),

	createTopic: formAction((data) => ({
		topic: createTopic(db, {
			courseId: trimmed(data, 'courseId'),
			name: String(data.get('name') ?? '')
		})
	})),

	renameTopic: formAction((data) => ({
		topic: found(
			renameTopic(db, { id: trimmed(data, 'id'), name: String(data.get('name') ?? '') }),
			'Topic'
		)
	})),

	moveTopic: formAction((data) => ({
		topic: found(
			moveTopicToCourse(db, { id: trimmed(data, 'id'), courseId: trimmed(data, 'courseId') }),
			'Topic'
		)
	})),

	deleteTopic: formAction((data) => {
		found(
			deleteTopic(db, trimmed(data, 'id'), {
				confirmed: trimmed(data, 'confirmed') === 'true'
			}),
			'Topic'
		);
		return {};
	}),

	createLesson: formAction((data) => ({
		lesson: createLesson(db, {
			topicId: trimmed(data, 'topicId'),
			title: String(data.get('title') ?? '')
		}).lesson
	})),

	moveLesson: formAction((data) => {
		const direction = trimmed(data, 'direction');
		if (direction !== 'up' && direction !== 'down') {
			throw new Refused('invalid', 'Bad direction.');
		}
		moveLesson(db, { topicId: trimmed(data, 'topicId'), id: trimmed(data, 'id'), direction });
		return {};
	})
};
