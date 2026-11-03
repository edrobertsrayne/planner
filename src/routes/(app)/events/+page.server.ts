import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { formAction } from '$lib/server/form';
import { createEvent, listEvents } from '$lib/server/planner';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ events: listEvents(db, { today: today() }) });

export const actions: Actions = {
	createEvent: formAction((data) => ({
		event: createEvent(db, {
			name: String(data.get('name') ?? ''),
			kind: String(data.get('kind') ?? '')
		})
	}))
};
