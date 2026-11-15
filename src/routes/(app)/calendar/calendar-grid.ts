import { rowIndexOf, type DayRow } from '$lib/bell';
import { PERIODS } from '$lib/periods';
import type { CalendarCell, CoverRef } from '$lib/server/planner';

// One entry per (day, row): the cell that starts in this row, a row an earlier start's rowspan
// covers (a Lesson with Length > 1), a Period no Class holds, or a band only an Event can hold —
// Before school, After school, and the Break and Lunch rows a Bell Schedule puts between the
// Periods (ADR-0033). A Blocked Day or Blocked Slot arrives as an ordinary `blocked` cell that
// *starts* somewhere; a Period no Class holds is never a cell at all (calendarWeek leaves it out),
// so "removed" and "never applicable" stay distinct.
export type GridEntry =
	| { type: 'start'; cell: CalendarCell; span: number }
	| { type: 'covered' }
	| { type: 'free' }
	| { type: 'band' };

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

// One line per Slot an Absence takes on the date, with its Cover: what the day's menu offers Set
// cover or Clear cover from, and what an absent day's panel lists, since a day with no teaching
// draws no tiles (ADR-0030).
export interface AbsentSlotLine {
	slotId: string;
	period: number;
	classId: string;
	classLabel: string;
	tone: number;
	room: string | null;
	cover: CoverRef | null;
}

export function absentSlotLines(cells: readonly CalendarCell[], date: string): AbsentSlotLine[] {
	return linesOn(cells, date, (c) =>
		c.kind === 'blocked' && c.absent
			? [
					{
						slotId: c.slotIds[0],
						period: c.periodFrom,
						classId: c.classId,
						classLabel: c.classLabel,
						tone: c.tone,
						room: c.room,
						cover: c.cover
					}
				]
			: []
	);
}

// One column per day, one entry per row of `rows`. A cell's Periods are split wherever a row no
// Class holds interrupts them, so a Lesson or Blocked Slot across a Break or Lunch draws one tile
// either side and the band keeps its own row and its own Event: a Duty at Lunch must never be
// covered by a double's rowspan.
export function toGrid(
	days: readonly { date: string }[],
	cells: readonly CalendarCell[],
	rows: readonly DayRow[]
): GridEntry[][] {
	const dates = days.map((d) => d.date);
	const grid = dates.map(() =>
		rows.map((row): GridEntry =>
			PERIODS.includes(row.position) ? { type: 'free' } : { type: 'band' }
		)
	);
	const rowOfPeriod = new Map<number, number>();
	rows.forEach((row, i) => {
		if (PERIODS.includes(row.position)) rowOfPeriod.set(row.position, i);
	});
	for (const cell of cells) {
		const di = dates.indexOf(cell.date);
		if (di < 0) continue;
		// Write one start per run of adjacent rows, so a band between a double's Periods keeps its
		// own row instead of being swallowed by the rowspan.
		let run: number[] = [];
		const flush = () => {
			if (run.length === 0) return;
			grid[di][run[0]] = { type: 'start', cell, span: run.length };
			for (const ri of run.slice(1)) grid[di][ri] = { type: 'covered' };
			run = [];
		};
		for (let p = cell.periodFrom; p <= cell.periodTo; p++) {
			const ri = rowOfPeriod.get(p);
			if (ri === undefined) continue;
			const last = run[run.length - 1];
			if (last !== undefined && ri !== last + 1) flush();
			run.push(ri);
		}
		flush();
	}
	return grid;
}

// The Events of a week laid out like `toGrid`: one slot per day for each row of the day, so an
// Event at Break or Lunch lands in the row its Bell Schedule times (ADR-0033). An Event never
// shares a row with a Class's cell, so the two grids are read side by side.
export function toEventGrid<
	Event extends { date: string; position: number; scheduleId: string | null }
>(
	days: readonly { date: string }[],
	events: readonly Event[],
	rows: readonly DayRow[]
): (Event | null)[][] {
	const dates = days.map((d) => d.date);
	const grid: (Event | null)[][] = dates.map(() => rows.map(() => null));
	for (const event of events) {
		const di = dates.indexOf(event.date);
		if (di < 0) continue;
		const ri = rowIndexOf(rows, event.position, event.scheduleId);
		if (ri >= 0) grid[di][ri] = event;
	}
	return grid;
}

// How many rows the Event in each row fills, so one Event across adjacent Periods draws as a single
// block like a double Lesson: the count at the row it starts, 0 at a row an earlier block covers, 1
// for anything else. Only adjacent Period rows of one Event merge: Before school and After school
// are bands of their own, and a Break or Lunch row between two Periods is not adjacent to either,
// so the run stops and the band keeps its own row (ADR-0033).
export function eventSpans(column: readonly ({ eventId: string; position: number } | null)[]) {
	const spans = column.map(() => 1);
	for (let i = 0; i < column.length; i++) {
		const here = column[i];
		if (!here || spans[i] === 0) continue;
		for (let j = i + 1; j < column.length; j++) {
			const prev = column[j - 1];
			const next = column[j];
			// Both Periods, in Period order; the rows are adjacent by construction of the loop.
			if (!prev || !next || next.eventId !== here.eventId) break;
			if (prev.position < 1 || prev.position > 5 || next.position !== prev.position + 1) break;
			spans[i]++;
			spans[j] = 0;
		}
	}
	return spans;
}
