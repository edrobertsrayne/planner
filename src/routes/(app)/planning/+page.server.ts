import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { lessonActions } from '$lib/server/lesson-actions';
import { listClasses, planningStream } from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	// An unknown `class` id falls back to every Class rather than an error.
	const classes = listClasses(db);
	const classParam = url.searchParams.get('class');
	const classId = classes.find((c) => c.id === classParam)?.id;
	return { stream: planningStream(db, today(), classId), classes, classId };
};

export const actions: Actions = {
	...lessonActions
};
