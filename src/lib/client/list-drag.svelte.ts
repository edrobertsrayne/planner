// A drag that reorders one flat list, as a Topic's Lessons in the Course editor: a press on a
// row's grip carries that row, a line shows where it will land, and the drop names the row whose
// place it takes. It runs on the Sequence tab's engine (`sequence-drag`) and its order rule
// (`movedOrder`), so both lists behave alike. Each row marks itself with `data-drop={id}`.
import { createSequenceDrag, type DragSnapshot } from './sequence-drag';
import { movedOrder } from '$lib/sequence-order';

export interface ListDrag {
	readonly draggedId: string | null;
	readonly ghost: { x: number; y: number };
	start: (event: PointerEvent, id: string) => void;
	move: (event: PointerEvent) => void;
	end: (drop: boolean) => void;
	// Where the drop line sits on a row, or null when it is not the target of a drop that moves.
	dropLine: (id: string) => 'above' | 'below' | null;
}

export function createListDrag(options: {
	// The rows' ids in their current order, read as a getter.
	order: () => string[];
	onDrop: (id: string, targetId: string) => void;
}): ListDrag {
	let state = $state<DragSnapshot>({
		ids: [],
		grabbedId: null,
		overId: null,
		point: { x: 0, y: 0 }
	});
	const drag = createSequenceDrag({
		onChange: (snapshot) => (state = snapshot),
		onDrop: (ids, targetId) => options.onDrop(ids[0], targetId)
	});

	return {
		get draggedId() {
			return state.grabbedId;
		},
		get ghost() {
			return state.point;
		},
		start(event, id) {
			if (
				drag.active() ||
				!event.isPrimary ||
				(event.pointerType === 'mouse' && event.button !== 0)
			)
				return;
			event.preventDefault();
			drag.start(event, [id], id);
		},
		move: drag.move,
		end: drag.end,
		dropLine(id) {
			const { ids, overId } = state;
			if (overId !== id || !movedOrder(options.order(), ids, id)) return null;
			// The line sits on the side of the target that the row comes from.
			const order = options.order();
			return order.indexOf(id) < order.indexOf(ids[0]) ? 'above' : 'below';
		}
	};
}
