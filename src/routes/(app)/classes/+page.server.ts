import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { assignTopic, classLanes, createClass, listCourses, topicsOf } from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

function today() {
	return new Date().toISOString().slice(0, 10);
}

function trimmed(data: FormData, field: string) {
	return String(data.get(field) ?? '').trim();
}

export const load: PageServerLoad = () => {
	const courses = listCourses(db);
	const lanes = classLanes(db, { today: today() });

	const courseTopics: Record<string, ReturnType<typeof topicsOf>> = {};
	for (const courseId of new Set(lanes.map((l) => l.courseId))) {
		courseTopics[courseId] = topicsOf(db, courseId);
	}

	return { courses, lanes, courseTopics };
};

export const actions: Actions = {
	createClass: async ({ request }) => {
		const data = await request.formData();
		const label = trimmed(data, 'label');
		const courseId = trimmed(data, 'courseId');
		if (!label) return fail(400, { error: 'A Class needs a label.' });
		if (!courseId) return fail(400, { error: 'A Class needs a Course.' });
		return { class: createClass(db, { label, courseId }) };
	},

	assignTopic: async ({ request }) => {
		const data = await request.formData();
		const classId = trimmed(data, 'classId');
		const topicId = trimmed(data, 'topicId');
		if (!topicId) return fail(400, { error: 'Pick a Topic to assign.' });
		try {
			const report = assignTopic(db, { classId, topicId, today: today() });
			return { atRisk: report.atRisk };
		} catch (error) {
			return fail(400, {
				error: error instanceof Error ? error.message : 'Could not assign the Topic.'
			});
		}
	}
};
