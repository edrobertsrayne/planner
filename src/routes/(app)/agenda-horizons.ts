// The Agenda's horizon: a window of calendar days from today, or 'all' to the end of the last Term
// (issue #281). Shared between the load function (which validates the `?horizon=` param) and the
// view (which renders the horizon tabs).
export const AGENDA_HORIZONS = [
	[7, 'This Week'],
	[14, 'Two Weeks'],
	[28, 'Four Weeks'],
	['all', 'All']
] as const;

export type AgendaHorizon = (typeof AGENDA_HORIZONS)[number][0];

// The `?horizon=` value as a horizon; a missing or unknown value gives This Week.
export function parseHorizon(param: string | null): AgendaHorizon {
	return AGENDA_HORIZONS.find(([value]) => String(value) === param)?.[0] ?? 7;
}
