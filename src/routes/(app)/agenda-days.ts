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

// The Agenda's Tag filter (issue #280), applied to the rows the page already has. A Tag keeps only
// the Lessons that carry it, by exact name, so Open Slots drop out; no Tag keeps every row.
type TaggedRow = { lesson: { tags: readonly string[] } | null };

export function filterByTag<Row extends TaggedRow>(rows: readonly Row[], tag: string | null) {
	return tag === null ? rows : rows.filter((row) => row.lesson?.tags.includes(tag));
}

// The distinct Tag names on the Lessons in the window, in alphabetical order, for the filter control.
export function tagsIn(rows: readonly TaggedRow[]): string[] {
	const tags = new Set(rows.flatMap((row) => row.lesson?.tags ?? []));
	return [...tags].sort((a, b) => a.localeCompare(b));
}

// The last day a horizon of `horizonDays` covers, today counting as the first — the same
// arithmetic the load's `agenda` call applies when it filters, so prose about the window names
// the day it actually reaches. The All horizon reaches the last day of the last Term.
export const horizonEndsOn = (today: string, horizon: number | 'all', lastTermCloses: string) =>
	horizon === 'all' ? lastTermCloses : addDays(today, horizon - 1);
