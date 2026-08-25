// Explicit ordering, shared by the four things that carry a `position`: a Class's Assigned
// Topics, a Topic's Lessons, a Lesson's Links, and a Lesson moved between Topics. Pure — the
// caller owns the query and the update, so which table is being ordered stays visible at the
// call site; only the arithmetic lives here.

// Appended at the end: the next position after the highest in use, or 0 for the first.
export function nextPosition(rows: readonly { position: number }[]): number {
	return rows.length === 0 ? 0 : Math.max(...rows.map((row) => row.position)) + 1;
}

export type Direction = 'up' | 'down';

// The two rows whose positions a move swaps, or null when the move runs off either end — off
// the end is a no-op everywhere, never an error and never a wraparound (issue #33).
export function swapTargets<Row extends { id: string; position: number }>(
	rows: readonly Row[],
	id: string,
	direction: Direction
): [Row, Row] | null {
	const index = rows.findIndex((row) => row.id === id);
	const other = direction === 'up' ? index - 1 : index + 1;
	if (index < 0 || other < 0 || other >= rows.length) return null;
	return [rows[index], rows[other]];
}
