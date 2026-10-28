import { db } from '$lib/server/db/client';
import { formAction } from '$lib/server/form';
import { courseTiles, createCourse } from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ courses: courseTiles(db) });

export const actions: Actions = {
	createCourse: formAction((data) => ({
		course: createCourse(db, { name: String(data.get('name') ?? '') })
	}))
};
