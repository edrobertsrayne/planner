import { addDays } from '$lib/date';

// The week "now" names: the Teaching Week today falls inside, or — during a break, when no
// Teaching Week covers today — the next one to come, or the last of the year once even that
// has run out. A bare load opens on it; the Today button returns to it.
export function defaultWeek(weeks: { weekCommencing: string }[], on: string): string | null {
	if (weeks.length === 0) return null;
	const containing = weeks.find(
		(w) => on >= w.weekCommencing && on <= addDays(w.weekCommencing, 4)
	);
	if (containing) return containing.weekCommencing;
	const upcoming = weeks.find((w) => w.weekCommencing > on);
	if (upcoming) return upcoming.weekCommencing;
	return weeks[weeks.length - 1].weekCommencing;
}
