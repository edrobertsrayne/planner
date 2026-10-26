// The Sequence tab's drag engine (#428): a pointer press on a grip carries one Lesson or a picked
// set, hit-tests the cards under the pointer, scrolls when the pointer nears a window edge, and
// reports the drop. Framework-free, like teaching-note.ts: no Svelte, and the browser is reached
// only from the calls the component makes.

export interface DragSnapshot {
	// The Lessons being carried, in Sequence order.
	ids: string[];
	// The Lesson whose grip was pressed — the ghost's label when a selection is carried.
	grabbedId: string | null;
	// The card under the pointer, or null.
	overId: string | null;
	// Where to draw the ghost.
	point: { x: number; y: number };
}

export interface SequenceDragOptions {
	// Every change to the snapshot: the press, each move, each auto-scroll step and the drop.
	onChange: (snapshot: DragSnapshot) => void;
	// The pointer went up over a card, on a drop that would move something.
	onDrop: (ids: string[], targetId: string) => void;
}

export interface SequenceDrag {
	// Begins a drag carrying `ids`; the caller has already ruled out a secondary button.
	start: (event: PointerEvent, ids: string[], grabbedId: string) => void;
	move: (event: PointerEvent) => void;
	// The pointer went up. `drop` is false for a cancelled pointer.
	end: (drop: boolean) => void;
	// Escape or a cancelled pointer: put everything down and move nothing.
	cancel: () => void;
	active: () => boolean;
}

// How close to a window edge the pointer starts scrolling, and how far each step goes.
const EDGE = 80;
const SCROLL_STEP = 16;

export function createSequenceDrag({ onChange, onDrop }: SequenceDragOptions): SequenceDrag {
	let ids: string[] = [];
	let grabbedId: string | null = null;
	let overId: string | null = null;
	let point = { x: 0, y: 0 };
	let frame = 0;

	const snapshot = (): DragSnapshot => ({ ids, grabbedId, overId, point });
	const active = () => ids.length > 0;

	function hitTest() {
		const el = document.elementFromPoint(point.x, point.y)?.closest<HTMLElement>('[data-drop]');
		overId = el?.dataset.drop ?? null;
	}

	function stop() {
		cancelAnimationFrame(frame);
		frame = 0;
		ids = [];
		grabbedId = null;
		overId = null;
		onChange(snapshot());
	}

	// Near the top or bottom edge of the window, scroll a step and hit-test again, so a card can
	// be reached that is not on screen when the drag starts.
	function scrollLoop() {
		const step =
			point.y < EDGE ? -SCROLL_STEP : point.y > window.innerHeight - EDGE ? SCROLL_STEP : 0;
		if (step !== 0) {
			window.scrollBy(0, step);
			hitTest();
			onChange(snapshot());
		}
		frame = requestAnimationFrame(scrollLoop);
	}

	return {
		start(event, carried, grip) {
			ids = carried;
			grabbedId = grip;
			overId = null;
			point = { x: event.clientX, y: event.clientY };
			onChange(snapshot());
			frame = requestAnimationFrame(scrollLoop);
		},
		move(event) {
			if (!active()) return;
			point = { x: event.clientX, y: event.clientY };
			hitTest();
			onChange(snapshot());
		},
		end(drop) {
			if (!active()) return;
			const target = overId;
			const carried = ids;
			stop();
			if (!drop || !target) return;
			onDrop(carried, target);
		},
		cancel() {
			if (active()) stop();
		},
		active
	};
}
