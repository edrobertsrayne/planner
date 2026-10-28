// How a Sequence lies on the Slots of a By week layout. Pure, and only the Sequence tab uses it: it
// draws the layout at rest and as the live preview during a drag, from the order a drop would
// write. The Slots stay in place; the Lessons go through them, one part to a Slot, as the engine
// lays them (ADR-0026).
import type { WeekRow } from '$lib/server/planner';

export interface SlotFill {
	lessonId: string;
	part: number;
	of: number;
}

export interface SequenceLayout {
	fills: Map<string, SlotFill>;
	pastEnd: string[];
}

// `order`: the Lessons in Sequence order. `parts`: the Slots each still takes (none for a taught
// Lesson, so it takes none). `slotKeys`: the Slots they may take, in calendar order. A Lesson with
// no Slot left is past the end.
export function layOutSequence(
	order: string[],
	parts: Map<string, number>,
	slotKeys: string[]
): SequenceLayout {
	const fills = new Map<string, SlotFill>();
	const pastEnd: string[] = [];
	let next = 0;
	for (const lessonId of order) {
		const of = parts.get(lessonId) ?? 0;
		for (let part = 1; part <= of; part++) {
			if (next < slotKeys.length) fills.set(slotKeys[next++], { lessonId, part, of });
			else if (!pastEnd.includes(lessonId)) pastEnd.push(lessonId);
		}
	}
	return { fills, pastEnd };
}

// The movable Slots of the week rows, in calendar order: where the Lessons go. A holiday row holds
// no Slots.
export function movableSlotKeys(weeks: readonly WeekRow[]): string[] {
	return weeks.flatMap((row) =>
		row.kind === 'week'
			? row.cells.filter((cell) => cell.kind === 'movable').map((cell) => cell.key)
			: []
	);
}

// What a drop would change, given the layout at rest and the one the drop would write: the Lessons
// whose first Slot differs, and the Lessons to keep listed past the end. A card under a finger is
// never removed; one the drop would push out joins the ones already there. Both in Sequence order.
export function previewDiff(
	resting: SequenceLayout,
	layout: SequenceLayout,
	order: readonly string[]
): { changing: Set<string>; pastEndShown: string[] } {
	const before = firstSlots(resting.fills);
	const after = firstSlots(layout.fills);
	return {
		changing: new Set(order.filter((lessonId) => before[lessonId] !== after[lessonId])),
		pastEndShown: order.filter(
			(lessonId) => resting.pastEnd.includes(lessonId) || layout.pastEnd.includes(lessonId)
		)
	};
}

// The first Slot each Lesson fills, by Lesson id.
function firstSlots(fills: Map<string, SlotFill>): Record<string, string> {
	const first: Record<string, string> = {};
	for (const [key, fill] of fills) first[fill.lessonId] ??= key;
	return first;
}

// Where "+ Add" on a week puts a Lesson: in front of the first Lesson that starts in the week (so
// the new one takes that Slot), else, when the week has only Open Slots, at the end of the
// Sequence. Null in a week with no movable Slot (no "+ Add" there).
export function weekAddAnchor(
	row: Extract<WeekRow, { kind: 'week' }>,
	fills: ReadonlyMap<string, SlotFill>,
	order: readonly string[]
): { after: string | null } | null {
	const open = row.cells.find(
		(cell) => cell.kind === 'movable' && (fills.get(cell.key)?.part ?? 1) === 1
	);
	if (!open) return null;
	const at = fills.get(open.key);
	const index = at ? order.indexOf(at.lessonId) : order.length;
	return { after: order[index - 1] ?? null };
}
