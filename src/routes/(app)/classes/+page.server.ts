import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { formAction, trimmed } from '$lib/server/form';
import {
	assignTopic,
	classLanes,
	createClass,
	listCourses,
	reportOf,
	topicOptions
} from '$lib/server/planner';
import { assignLines, sequenceAnswer } from '$lib/sequence-text';
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
	assignTopic: formAction((data) => {
		const result = assignTopic(db, {
			classId: trimmed(data, 'classId'),
			topicId: trimmed(data, 'topicId'),
			today: today()
		});
		return sequenceAnswer('assign', {
			report: reportOf(result),
			changed: result.changed,
			lines: assignLines(result)
		});
	}),
	createClass: formAction((data) => ({
		class: createClass(db, {
			label: String(data.get('label') ?? ''),
			courseId: trimmed(data, 'courseId')
		})
	}))
};
