import { db } from '$lib/server/db/client';
import { refusal } from '$lib/server/form';
import { createCourse, listCourses } from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ courses: listCourses(db) });

export const actions: Actions = {
	createCourse: async ({ request }) => {
		const name = String((await request.formData()).get('name') ?? '');
		try {
			return { course: createCourse(db, { name }) };
		} catch (error) {
			return refusal(error);
		}
	}
};
