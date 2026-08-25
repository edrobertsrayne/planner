import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { agenda } from '$lib/server/planner';
import { AGENDA_HORIZONS, type AgendaHorizonDays } from './agenda-horizons';
import type { PageServerLoad } from './$types';

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
