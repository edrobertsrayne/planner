import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { formAction, trimmed } from '$lib/server/form';
import {
	clearCoverAction,
	setCoverAction,
	blockDayAction,
	blockSlotAction,
	unblockDayAction,
	unblockSlotAction
} from '$lib/server/block-actions';
import {
	agenda,
	agendaLookBack,
	agendaLookBackBlockedDays,
	agendaLookBackEvents,
	coverChoices,
	setReadiness
} from '$lib/server/planner';
import { parseHorizon } from './agenda-horizons';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const horizon = parseHorizon(url.searchParams.get('horizon'));
	// The look-back is off unless `?past=1`; any other value is off.
	const lookBackOn = url.searchParams.get('past') === '1';
	const ahead = agenda(db, {
		today: today(),
		horizonDays: horizon === 'all' ? null : horizon
	});

	return {
		today: today(),
		horizon,
		tag: url.searchParams.get('tag') || null,
		lookBackOn,
		...ahead,
		coverChoices: coverChoices(db),
		lookBack: lookBackOn ? agendaLookBack(db, { today: today() }) : [],
		lookBackBlockedDays: lookBackOn ? agendaLookBackBlockedDays(db, { today: today() }) : [],
		lookBackEvents: lookBackOn ? agendaLookBackEvents(db, { today: today() }) : []
	};
};

export const actions: Actions = {
	setReadiness: formAction((data) => {
		setReadiness(db, trimmed(data, 'lessonId'), trimmed(data, 'classId'), data.has('ready'));
		return {};
	}),

	blockDay: blockDayAction,

	unblockDay: unblockDayAction,

	blockSlot: blockSlotAction,

	unblockSlot: unblockSlotAction,

	setCover: setCoverAction,

	clearCover: clearCoverAction
};
