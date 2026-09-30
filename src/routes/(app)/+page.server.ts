import { fail } from '@sveltejs/kit';
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { trimmed } from '$lib/server/form';
import { agenda, agendaLookBack, setReadiness } from '$lib/server/planner';
import { parseHorizon } from './agenda-horizons';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const horizon = parseHorizon(url.searchParams.get('horizon'));
	const { rows, lastTermCloses } = agenda(db, {
		today: today(),
		horizonDays: horizon === 'all' ? null : horizon
	});

	return {
		today: today(),
		horizon,
		tag: url.searchParams.get('tag') || null,
		rows,
		lastTermCloses,
		lookBack: agendaLookBack(db, { today: today() })
	};
};

export const actions: Actions = {
	setReadiness: async ({ request }) => {
		const data = await request.formData();
		const lessonId = trimmed(data, 'lessonId');
		const classId = trimmed(data, 'classId');
		if (!lessonId || !classId) {
			return fail(400, { error: 'lessonId and classId are required.' });
		}
		setReadiness(db, lessonId, classId, data.has('ready'));
		return {};
	}
};
