import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { refusal, trimmed } from '$lib/server/form';
import { classLanes, createClass, listCourses } from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const courses = listCourses(db);
	const lanes = classLanes(db, { today: today() });

	return { courses, lanes };
};

export const actions: Actions = {
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
