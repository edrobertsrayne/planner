// PROTOTYPE — throwaway. Read-only load combining the real agenda and calendar-week data so all
// three variants can be judged against Ed's actual data, not fixtures. See issue #61.
import { db } from '$lib/server/db';
import { addDays, agenda, calendarWeek, teachingWeeksList } from '$lib/server/planner';
import type { PageServerLoad } from './$types';

function today() {
	return new Date().toISOString().slice(0, 10);
}

// Same "the week today falls inside, else the next one to come" rule as the real Calendar route.
function defaultWeek(weeks: { weekCommencing: string }[], on: string): string | null {
	if (weeks.length === 0) return null;
	const containing = weeks.find(
		(w) => on >= w.weekCommencing && on <= addDays(w.weekCommencing, 4)
	);
	if (containing) return containing.weekCommencing;
	const upcoming = weeks.find((w) => w.weekCommencing > on);
	if (upcoming) return upcoming.weekCommencing;
	return weeks[weeks.length - 1].weekCommencing;
}

export const load: PageServerLoad = ({ url }) => {
	const t = today();

	const rows = agenda(db, { today: t, horizonDays: 14 });

	const weeks = teachingWeeksList(db);
	const requestedWeek = url.searchParams.get('week');
	const selected =
		(requestedWeek && weeks.some((w) => w.weekCommencing === requestedWeek)
			? requestedWeek
			: null) ?? defaultWeek(weeks, t);
	const week = selected ? calendarWeek(db, { weekCommencing: selected, today: t }) : null;
	const index = selected ? weeks.findIndex((w) => w.weekCommencing === selected) : -1;
	const prev = index > 0 ? weeks[index - 1].weekCommencing : null;
	const next = index >= 0 && index < weeks.length - 1 ? weeks[index + 1].weekCommencing : null;

	return { today: t, rows, week, prev, next };
};
