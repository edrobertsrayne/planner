import { PERIODS } from '$lib/periods';
import type { CalendarCell } from '$lib/server/planner';

// The Calendar screen imports the Periods from here, so the shared list is passed on.
export { PERIODS };

// One entry per (day, Period): the cell that starts there, a Period covered by an earlier cell's
// rowspan (a Lesson with Length > 1), or genuinely free. A Blocked Day or Blocked Slot
// arrives as an ordinary `blocked` cell that *starts* here; a Period no Class holds is never a
// cell at all (calendarWeek leaves it out), so "removed" and "never applicable" stay distinct.
export type GridEntry =
	{ type: 'start'; cell: CalendarCell } | { type: 'covered' } | { type: 'free' };

// One line per Available Slot a day's menu offers to block: every non-blocked cell on the
// date, read out per Slot in Period order — a Lesson over two Periods appears twice, once per
// real Slot (issue #192). Blocked cells offer nothing; their Slot is already gone. `placeable`
// is the cell's own "may a Lesson be Placed here" answer, the same one the Session panel's
// `canPlace` carries: false on a past date and on an occasion that already holds a placed
// Lesson, true for an Open Slot and for a Slot a Topic Lesson holds (Placing there shift-rights
// that Lesson).
export interface AvailableSlotLine {
	slotId: string;
	period: number;
	classId: string;
	classLabel: string;
	placeable: boolean;
}

// The date filter and the Period sort both menu-line derivations share, spelled once.
function linesOn<T extends { period: number }>(
	cells: readonly CalendarCell[],
	date: string,
	lines: (c: CalendarCell) => T[]
): T[] {
	return cells
		.filter((c) => c.date === date)
		.flatMap(lines)
		.sort((a, b) => a.period - b.period);
}

export function availableSlotLines(
	cells: readonly CalendarCell[],
	date: string
): AvailableSlotLine[] {
	return linesOn(cells, date, (c) =>
		c.kind === 'blocked'
			? []
			: c.slotIds.map((slotId, i) => ({
					slotId,
					period: c.periodFrom + i,
					classId: c.classId,
					classLabel: c.classLabel,
					placeable: c.placeable
				}))
	);
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
	return linesOn(cells, date, (c) =>
		c.kind === 'blocked' && c.blockedSlotId !== null
			? [{ blockedSlotId: c.blockedSlotId, period: c.periodFrom, classLabel: c.classLabel }]
			: []
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

// The Events of a week laid out like `toGrid`: one slot per day for each of the eight positions,
// 0 Before school, 1 to 6 the Periods, 7 After school (ADR-0029). An Event never shares a position
// with a Class's cell, so the two grids are read side by side.
export function toEventGrid<Event extends { date: string; position: number }>(
	days: readonly { date: string }[],
	events: readonly Event[]
): (Event | null)[][] {
	const dates = days.map((d) => d.date);
	const matrix: (Event | null)[][] = dates.map(() => Array.from({ length: 8 }, () => null));
	for (const event of events) {
		const di = dates.indexOf(event.date);
		if (di >= 0) matrix[di][event.position] = event;
	}
	return matrix;
}

// How many Periods the Event at each position of one day's column fills, so one Event across
// adjacent Periods draws as a single block like a double Lesson: the count at the position it
// starts, 0 at a position an earlier block covers, 1 for anything else. Only the six Periods
// merge; Before school (0) and After school (7) are bands of their own and stay single.
export function eventSpans(column: readonly ({ eventId: string; position: number } | null)[]) {
	const spans = column.map(() => 1);
	for (let p = 1; p <= 6; p++) {
		const here = column[p];
		if (!here || spans[p] === 0) continue;
		let q = p + 1;
		while (q <= 6 && column[q]?.eventId === here.eventId) {
			spans[p]++;
			spans[q] = 0;
			q++;
		}
	}
	return spans;
}
