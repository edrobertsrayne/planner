// Dates in this app are ISO calendar days — 'YYYY-MM-DD' — never Date objects and never
// timestamps. A Session happens on a date, not at an instant, so every comparison here is plain
// string comparison and every conversion pins UTC: parse a bare ISO day in a local time zone and
// it lands on the previous evening, which would shift a Lesson by a day for anyone west of
// Greenwich.
//
// Pure except for `today`, which is the one clock read in the codebase. The engine
// (server/planner/engine.ts) imports `addDays` alone and stays clock-free.

// The day `days` after `iso` — negative counts backwards.
export function addDays(iso: string, days: number): string {
	const [year, month, day] = iso.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

// The scheduling boundary every write is measured from: re-derivation writes on and after this
// date and never before it.
export function today(): string {
	return new Date().toISOString().slice(0, 10);
}

function format(iso: string, options: Intl.DateTimeFormatOptions): string {
	return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });
}

// '25 August 2026' — a date named in full, where it stands alone and must be unambiguous.
export const formatDate = (iso: string) =>
	format(iso, { day: 'numeric', month: 'long', year: 'numeric' });

// '25 Aug 2026' — the same date where space is short.
export const formatDateShort = (iso: string) =>
	format(iso, { day: 'numeric', month: 'short', year: 'numeric' });

// '25 Aug' — a day inside a week the reader is already looking at, so the year is noise.
export const formatDayMonth = (iso: string) => format(iso, { day: 'numeric', month: 'short' });

// 'Tuesday 25 August' — a day heading, where which weekday it is matters more than the year.
export const formatWeekday = (iso: string) =>
	format(iso, { weekday: 'long', day: 'numeric', month: 'long' });

// 'Tue 25 Aug' — a date with its short weekday, where day of the week matters but the year is known.
export const formatShortWeekday = (iso: string) =>
	format(iso, { weekday: 'short', day: 'numeric', month: 'short' });
