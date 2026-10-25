// How a Sequence lies on the Slots of a By week layout. Pure, and only the Sequence tab uses it: it
// draws the layout at rest and as the live preview during a drag, from the order a drop would
// write. The Slots stay in place; the Lessons go through them, one part to a Slot, as the engine
// lays them (ADR-0026).

export interface SlotFill {
	lessonId: string;
	part: number;
	of: number;
}

// `order`: the Lessons in Sequence order. `parts`: the Slots each still takes (none for a taught
// Lesson, so it takes none). `slotKeys`: the Slots they may take, in calendar order. A Lesson with
// no Slot left is past the end.
export function layOutSequence(
	order: string[],
	parts: Map<string, number>,
	slotKeys: string[]
): { fills: Map<string, SlotFill>; pastEnd: string[] } {
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
