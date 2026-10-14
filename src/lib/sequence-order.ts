// How a Move changes the order of a Sequence. Pure, and shared: the Sequence seam writes this order
// and the Sequence tab shows it during a drag, so the two cannot disagree.

// The Lessons of `moved` go together, in their current order, into the place of `targetId`. Below
// the first moved Lesson, they go after the target; above it, in front of the target. With one
// Lesson this is "take the target's place": the Lessons between move one place the other way.
// Null when the target is itself moved, or when `order` lacks the target or a moved Lesson.
export function movedOrder(order: string[], moved: string[], targetId: string): string[] | null {
	const group = order.filter((id) => moved.includes(id));
	if (group.length !== new Set(moved).size || !order.includes(targetId)) return null;
	if (group.includes(targetId)) return null;

	const rest = order.filter((id) => !moved.includes(id));
	const down = order.indexOf(targetId) > order.indexOf(group[0]);
	const at = rest.indexOf(targetId) + (down ? 1 : 0);
	return [...rest.slice(0, at), ...group, ...rest.slice(at)];
}
