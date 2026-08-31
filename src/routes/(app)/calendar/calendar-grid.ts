import type { CalendarCell } from '$lib/server/planner';

// One entry per (day, Period): the cell that starts there, a Period covered by an earlier cell's
// rowspan (a Lesson with Length > 1), or genuinely free. A Blocked Day or Blocked Slot
// arrives as an ordinary `blocked` cell that *starts* here; a Period no Class holds is never a
// cell at all (calendarWeek leaves it out), so "removed" and "never applicable" stay distinct.
export type GridEntry =
	{ type: 'start'; cell: CalendarCell } | { type: 'covered' } | { type: 'free' };

export const PERIODS = [1, 2, 3, 4, 5, 6];

// One line per Slot a day's menu offers to block: every non-blocked cell on the date, read out
// per Slot in Period order — a Lesson over two Periods appears twice, once per real Slot
// (issue #192). Blocked cells offer nothing; their Slot is already gone.
export interface BlockableSlot {
	slotId: string;
	period: number;
	classId: string;
	classLabel: string;
}

export function blockableSlots(cells: readonly CalendarCell[], date: string): BlockableSlot[] {
	return cells
		.filter((c) => c.date === date && c.kind !== 'blocked')
		.flatMap((c) =>
			c.slotIds.map((slotId, i) => ({
				slotId,
				period: c.periodFrom + i,
				classId: c.classId,
				classLabel: c.classLabel
			}))
		)
		.sort((a, b) => a.period - b.period);
}

// One line in a day's menu per Blocked Slot on the date: the removal's own id, whose Class and
// Period it was, so the Unblock survives the collapse of the day's column — a day with no
// teaching draws one panel and no tiles, yet the menu still holds the way back.
export interface BlockedSlotLine {
	blockedSlotId: string;
	period: number;
	classLabel: string;
}

export function blockedSlotLines(cells: readonly CalendarCell[], date: string): BlockedSlotLine[] {
	return cells.flatMap((c) =>
		c.date !== date || c.blockedSlotId === null
			? []
			: [{ blockedSlotId: c.blockedSlotId, period: c.periodFrom, classLabel: c.classLabel }]
	);
}

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
