import { addDays } from '$lib/date';

// The Agenda's day grouping (issue #87): the day is the unit — every date in the window gets a
// heading and a card, whether it holds five lessons or one. Pure: consecutive rows sharing a date
// form one day; the stream is expected sorted by date then Period, as `agenda` returns it.
export interface AgendaDay<Row> {
	date: string;
	rows: Row[];
}

export function groupByDay<Row extends { date: string }>(rows: readonly Row[]): AgendaDay<Row>[] {
	const days: AgendaDay<Row>[] = [];
	for (const row of rows) {
		const last = days[days.length - 1];
		if (last && last.date === row.date) last.rows.push(row);
		else days.push({ date: row.date, rows: [row] });
	}
	return days;
}

// The last day a horizon of `horizonDays` covers, today counting as the first — the same
// arithmetic the load's `agenda` call applies when it filters, so prose about the window names
// the day it actually reaches.
export const horizonEndsOn = (today: string, horizonDays: number) =>
	addDays(today, horizonDays - 1);
