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

// The distinct Tag names on the Lessons in the window with the count of rows that carry each, in
// alphabetical order, for the filter control (issue #340).
export function tagsIn(rows: readonly TaggedRow[]): { name: string; count: number }[] {
	const counts = new Map<string, number>();
	for (const row of rows)
		for (const tag of row.lesson?.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
	return [...counts]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => a.name.localeCompare(b.name));
}

// The Agenda's stream (issue #34): its teaching days, its Blocked Days and the School Holidays its
// window touches, in date order, so the teacher sees what is removed as well as what is taught. A
// holiday sits at its first day, so one already under way leads the stream.
export type AgendaItem<Row> =
	| ({ kind: 'day' } & AgendaDay<Row>)
	| { kind: 'blocked'; date: string; note: string | null }
	| { kind: 'holiday'; date: string; ends: string };

export function agendaStream<Row>(
	days: readonly AgendaDay<Row>[],
	blockedDays: readonly { date: string; note: string | null }[],
	holidays: readonly { starts: string; ends: string }[]
): AgendaItem<Row>[] {
	return [
		...days.map((day) => ({ kind: 'day' as const, ...day })),
		...blockedDays.map((day) => ({ kind: 'blocked' as const, ...day })),
		...holidays.map(({ starts, ends }) => ({ kind: 'holiday' as const, date: starts, ends }))
	].sort((a, b) => a.date.localeCompare(b.date));
}

// One line in an Agenda day: a Session row or an Event (ADR-0029). An Event never shares a Period
// with a Class, so each Event takes its own place by position: Before school (0) leads the day,
// the Periods (1 to 6) sit among the rows, and After school (7) closes it.
export type AgendaLine<Row, Event> = { kind: 'row'; row: Row } | { kind: 'event'; event: Event };

export function withEvents<
	Row extends { date: string; periodFrom: number },
	Event extends { date: string; position: number }
>(days: readonly AgendaDay<Row>[], events: readonly Event[]): AgendaDay<AgendaLine<Row, Event>>[] {
	const byDate = new Map<string, { at: number; line: AgendaLine<Row, Event> }[]>();
	const put = (date: string, at: number, line: AgendaLine<Row, Event>) =>
		byDate.set(date, [...(byDate.get(date) ?? []), { at, line }]);

	for (const day of days)
		for (const row of day.rows) put(day.date, row.periodFrom, { kind: 'row', row });
	for (const event of events) put(event.date, event.position, { kind: 'event', event });

	return [...byDate]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, lines]) => ({
			date,
			rows: lines.sort((a, b) => a.at - b.at).map((l) => l.line)
		}));
}

// How many Lessons a day holds, for the Block day dialog's "N Lessons move". Counted from every row
// of the window, never the Tag-filtered ones: the filter hides Lessons, it does not unschedule them.
export function lessonCount(rows: readonly { date: string; lesson: unknown }[], date: string) {
	return rows.filter((row) => row.date === date && row.lesson).length;
}
