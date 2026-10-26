import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { refusal, trimmed } from '$lib/server/form';
import {
	assignTopic,
	classLanes,
	createClass,
	listCourses,
	reportOf,
	topicOptions
} from '$lib/server/planner';
import { assignLines } from '$lib/sequence-text';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const courses = listCourses(db);
	const lanes = classLanes(db, { today: today() });

	const topics = Object.fromEntries(
		lanes.map((lane) => [
			lane.classId,
			topicOptions(db, { classId: lane.classId, courseId: lane.courseId })
		])
	);

	return { courses, lanes, topics };
};

export const actions: Actions = {
	assignTopic: async ({ request }) => {
		const data = await request.formData();
		try {
			const result = assignTopic(db, {
				classId: trimmed(data, 'classId'),
				topicId: trimmed(data, 'topicId'),
				today: today()
			});
			return { report: reportOf(result), lines: assignLines(result) };
		} catch (error) {
			return refusal(error);
		}
	},
	createClass: async ({ request }) => {
		const data = await request.formData();
		const label = String(data.get('label') ?? '');
		const courseId = trimmed(data, 'courseId');
		try {
			return { class: createClass(db, { label, courseId }) };
		} catch (error) {
			return refusal(error);
		}
	}
};
