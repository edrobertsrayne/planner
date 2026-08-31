// The Agenda's horizon: a window of calendar days from today, shared between the load function
// (which validates the `?horizon=` param) and the view (which renders the toggle).
export const AGENDA_HORIZONS = [
	[7, 'This Week'],
	[14, 'Two Weeks'],
	[28, 'Four Weeks']
] as const;

export type AgendaHorizonDays = (typeof AGENDA_HORIZONS)[number][0];
