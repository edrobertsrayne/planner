import type { CalendarCell } from '$lib/server/planner';

// One entry per (day, Period): the cell that starts there, a Period covered by an earlier cell's
// rowspan (a Lesson with Length > 1), or genuinely free. A Blocked Day or Blocked Slot
// arrives as an ordinary `blocked` cell that *starts* here; a Period no Class holds is never a
// cell at all (calendarWeek leaves it out), so "removed" and "never applicable" stay distinct.
export type GridEntry =
	{ type: 'start'; cell: CalendarCell } | { type: 'covered' } | { type: 'free' };

export const PERIODS = [1, 2, 3, 4, 5, 6];

export function toGrid(
	days: readonly { date: string }[],
	cells: readonly CalendarCell[]
): GridEntry[][] {
	const dates = days.map((d) => d.date);
	const matrix: GridEntry[][] = dates.map(() => PERIODS.map((): GridEntry => ({ type: 'free' })));
	for (const cell of cells) {
		const di = dates.indexOf(cell.date);
		if (di < 0) continue;
		matrix[di][cell.periodFrom - 1] = { type: 'start', cell };
		for (let p = cell.periodFrom + 1; p <= cell.periodTo; p++)
			matrix[di][p - 1] = { type: 'covered' };
	}
	return matrix;
}
