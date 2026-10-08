import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { trimmed } from '$lib/server/form';
import { lessonActions } from '$lib/server/lesson-actions';
import { listClasses, planningStream } from '$lib/server/planner';
import { prototypeLayout, prototypeSequence } from '../classes/[id]/prototype-sequence.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	// An unknown `class` id falls back to every Class rather than an error.
	const classes = listClasses(db);
	const classParam = url.searchParams.get('class');
	const cls = classes.find((c) => c.id === classParam);
	const classId = cls?.id;
	// PROTOTYPE (#372): with `?class=<id>&variant=C` this page shows one Class's Sequence as a
	// reorder draft, so the teacher can judge Planning itself as the surface.
	const proto = cls ? prototypeSequence(db, cls.id, cls.courseId) : null;
	const protoLayout =
		cls && proto
			? prototypeLayout(db, {
					classId: cls.id,
					today: today(),
					lessons: proto.sequence.map((l) => ({ id: l.id, length: l.length }))
				})
			: null;
	return {
		stream: planningStream(db, today(), classId),
		classes,
		classId,
		proto,
		protoLayout
	};
};

export const actions: Actions = {
	...lessonActions,
	// PROTOTYPE (#372): lays out a proposed order. Never writes.
	prototypeLayout: async ({ request }) => {
		const data = await request.formData();
		const classId = trimmed(data, 'classId');
		const lessons = JSON.parse(String(data.get('lessons'))) as { id: string; length: number }[];
		return { layout: prototypeLayout(db, { classId, today: today(), lessons }) };
	}
};
