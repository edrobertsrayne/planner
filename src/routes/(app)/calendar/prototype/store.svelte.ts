// PROTOTYPE ONLY (issue #312): a fake Calendar held in memory, built from the Agenda prototype's
// rows so a tile opens the same Session page. Blocked Days and Blocked Slots are local and lost on
// reload. Leaves with the prototype.
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { addDays, weekday } from '$lib/date';
import { TODAY, view, type Row } from '../../prototype-agenda/store.svelte';

export { TODAY };
export const PERIODS = [1, 2, 3, 4, 5, 6];
export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const all = (() => {
	const v = view('all', null, true);
	return [...v.back, ...v.ahead];
})();

// weekday() is 0 = Sunday … 6 = Saturday.
const monday = (iso: string) => addDays(iso, -((weekday(iso) + 6) % 7));
const FIRST_WEEK = monday(all[0].date);
const LAST_DAY = all[all.length - 1].date;

export type Week = { weekCommencing: string; letter: 'A' | 'B' };
export const WEEKS: Week[] = [];
for (let w = FIRST_WEEK, i = 0; w <= LAST_DAY; w = addDays(w, 7), i++)
	WEEKS.push({ weekCommencing: w, letter: i % 2 === 0 ? 'A' : 'B' });

// As the real load: the week today falls in, or the next one at a weekend.
export const CURRENT = monday([0, 6].includes(weekday(TODAY)) ? addDays(TODAY, 2) : TODAY);

// A School Holiday three weeks on (Wednesday), fixed; Blocked Days and Blocked Slots are local.
const HOLIDAY = addDays(CURRENT, 21 + 2);
export const blockedDays: Record<string, string> = $state({
	[addDays(CURRENT, 7 + 4)]: 'INSET day'
});
export const blockedSlots: Record<string, string> = $state({});
{
	const seed = all.find((r) => r.date === addDays(CURRENT, 1) && r.periodFrom === 3);
	if (seed) blockedSlots[seed.key] = 'Mock exams in the hall';
}

export type DayKind = 'teaching' | 'blocked' | 'holiday';
export type Cell =
	{ kind: 'lesson' | 'open'; row: Row } | { kind: 'blocked'; row: Row; note: string };
export type Day = {
	date: string;
	name: string;
	kind: DayKind;
	note: string | null;
	cells: Cell[];
	isToday: boolean;
};

export function weekDays(weekCommencing: string): Day[] {
	return DAY_NAMES.map((name, i) => {
		const date = addDays(weekCommencing, i);
		const kind: DayKind =
			date === HOLIDAY ? 'holiday' : blockedDays[date] !== undefined ? 'blocked' : 'teaching';
		const cells: Cell[] =
			kind !== 'teaching'
				? []
				: all
						.filter((r) => r.date === date)
						.map((row) =>
							blockedSlots[row.key] !== undefined
								? { kind: 'blocked', row, note: blockedSlots[row.key] }
								: { kind: row.lesson ? 'lesson' : 'open', row }
						);
		return {
			date,
			name,
			kind,
			note: kind === 'holiday' ? 'School holiday' : (blockedDays[date] ?? null),
			cells,
			isToday: date === TODAY
		};
	});
}

// One entry per (day, Period), as calendar-grid.ts builds it.
export type GridEntry = { type: 'start'; cell: Cell } | { type: 'covered' } | { type: 'free' };
export function grid(day: Day): GridEntry[] {
	const out: GridEntry[] = PERIODS.map(() => ({ type: 'free' }));
	for (const cell of day.cells) {
		out[cell.row.periodFrom - 1] = { type: 'start', cell };
		for (let p = cell.row.periodFrom + 1; p <= cell.row.periodTo; p++)
			out[p - 1] = { type: 'covered' };
	}
	return out;
}

// URL state, as on the real Calendar: `week`, plus `day` for variants that show one day.
export const weekParam = () => {
	const w = page.url.searchParams.get('week');
	return w && WEEKS.some((x) => x.weekCommencing === w) ? w : CURRENT;
};
export function set(params: Record<string, string | null>) {
	const url = new URL(page.url);
	for (const [k, v] of Object.entries(params)) {
		if (v) url.searchParams.set(k, v);
		else url.searchParams.delete(k);
	}
	goto(url, { replaceState: true, noScroll: true, keepFocus: true });
}
export const weekIndex = (w: string) => WEEKS.findIndex((x) => x.weekCommencing === w);

// A tile opens the Session page chosen in issue #311. The prototype's Session page lives on the
// Agenda's URL, so its Back reads "Agenda"; the real one returns to the Calendar.
export const openSession = (r: Row) => goto(`/?panel=D&session=${r.key}`);

// The day menu's acts, local.
export const blockDay = (date: string) => (blockedDays[date] = 'Blocked day');
export const unblockDay = (date: string) => delete blockedDays[date];
export const blockSlot = (r: Row, note: string) => (blockedSlots[r.key] = note);
export const unblockSlot = (r: Row) => delete blockedSlots[r.key];
