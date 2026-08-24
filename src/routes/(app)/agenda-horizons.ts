// The Agenda's horizon: a window of calendar days from today, shared between the load function
// (which validates the `?horizon=` param) and the view (which renders the toggle).
export const AGENDA_HORIZONS = [
	[1, 'Today'],
	[7, 'Next week'],
	[14, 'Next two weeks'],
	[28, 'Fortnight']
] as const;

export type AgendaHorizonDays = (typeof AGENDA_HORIZONS)[number][0];
