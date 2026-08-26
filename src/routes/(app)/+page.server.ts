import { fail } from '@sveltejs/kit';
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { trimmed } from '$lib/server/form';
import { agenda, setReadiness } from '$lib/server/planner';
import { AGENDA_HORIZONS, type AgendaHorizonDays } from './agenda-horizons';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const requested = Number(url.searchParams.get('horizon'));
	const validDays = AGENDA_HORIZONS.map(([days]) => days);
	const horizonDays: AgendaHorizonDays = validDays.includes(requested as AgendaHorizonDays)
		? (requested as AgendaHorizonDays)
		: 7;

	return {
		today: today(),
		horizonDays,
		rows: agenda(db, { today: today(), horizonDays })
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
