// How a Sequence lies on the Slots of a By week layout. Pure, and shared: the Sequence tab shows
// it as the live preview during a drag, from the order a drop would write. The Slots stay in
// place; the Lessons go through them, one part to a Slot, as the engine lays them (ADR-0026).

export interface SlotFill {
	lessonId: string;
	part: number;
	of: number;
}

// `order`: the Lessons that can still move, in order, with the Slots each takes. `slotKeys`: the
// Slots they may take, in calendar order. A Lesson with no Slot left is past the end.
export function layOutSequence(
	order: { lessonId: string; parts: number }[],
	slotKeys: string[]
): { fills: Map<string, SlotFill>; pastEnd: string[] } {
	const fills = new Map<string, SlotFill>();
	const pastEnd: string[] = [];
	let next = 0;
	for (const { lessonId, parts } of order) {
		for (let part = 1; part <= parts; part++) {
			if (next < slotKeys.length) fills.set(slotKeys[next++], { lessonId, part, of: parts });
			else if (!pastEnd.includes(lessonId)) pastEnd.push(lessonId);
		}
	}
	return { fills, pastEnd };
}
