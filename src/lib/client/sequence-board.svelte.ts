// The Sequence tab's board: what is selected, the drag in flight and the layout it previews, and
// the inline Add Lesson field. The tab creates it and hands the one object to both layouts; they
// only draw. The Move write and the Remove confirm stay with the tab.
import { createSequenceDrag, type DragSnapshot } from './sequence-drag';
import { SvelteMap } from 'svelte/reactivity';
import {
	layOutSequence,
	movableSlotKeys,
	previewDiff,
	type SequenceLayout
} from '$lib/sequence-layout';
import { movedOrder } from '$lib/sequence-order';
import type { SequenceResult } from '$lib/sequence-text';
import type { SequenceEntry, WeekRow } from '$lib/server/planner';

export interface SequenceBoardOptions {
	// The page's own props, read as getters: they can change under a board that is already built.
	entries: () => SequenceEntry[];
	weeks: () => WeekRow[];
	// The last write's outcome: the Lessons to ring and the old dates to say.
	result: () => SequenceResult | null;
	// A drop: the Lessons to move, and the target Lesson whose place they take. The tab writes it.
	onDrop: (lessonIds: string[], targetId: string) => void;
	// × or the select bar's Remove: the Lessons the confirm dialog asks about.
	onRemove: (entries: SequenceEntry[]) => void;
}

// The board both layouts draw from. Read-only views of its state; the methods are the only way to
// move it.
export interface SequenceBoard {
	readonly selectMode: boolean;
	readonly selectedIds: string[];
	readonly chosen: SequenceEntry[];
	readonly refusal: string | null;
	toggleSelect: () => void;
	endSelect: () => void;
	selectTopic: (topicId: string) => void;
	tap: (event: MouseEvent, entry: SequenceEntry) => void;
	forget: (lessonIds: string[]) => void;
	readonly adding: { row: number | 'tab'; afterLessonId: string | null } | null;
	openAdd: (row: number | 'tab', afterLessonId: string | null) => void;
	closeAdd: () => void;
	readonly dragIds: string[];
	readonly overId: string | null;
	readonly ghost: { x: number; y: number };
	readonly dragging: boolean;
	readonly dragged: SequenceEntry | undefined;
	start: (event: PointerEvent, lessonId: string) => void;
	move: (event: PointerEvent) => void;
	end: (drop: boolean) => void;
	dropLine: (lessonId: string) => 'above' | 'below' | null;
	readonly layout: SequenceLayout;
	readonly resting: SequenceLayout;
	readonly changing: Set<string>;
	readonly pastEnd: string[];
	readonly order: string[];
	readonly ringed: string[];
	readonly was: Map<string, string | null>;
	remove: (entry: SequenceEntry) => void;
}

const AT_REST: DragSnapshot = { ids: [], grabbedId: null, overId: null, point: { x: 0, y: 0 } };

export function createSequenceBoard(options: SequenceBoardOptions): SequenceBoard {
	const entries = $derived(options.entries());
	const ringed = $derived(options.result()?.ringed ?? []);
	// Each Lesson whose first Slot changed in the last write, with its old date.
	const was = $derived(
		new SvelteMap((options.result()?.changed ?? []).map((change) => [change.lessonId, change.was]))
	);

	// Select mode: a tap picks or clears a Lesson, a drag on a picked Lesson moves all picked ones,
	// and Done or Esc ends it. `chosen` is the selection in Sequence order, so a Lesson that left the
	// Sequence drops out of it by itself.
	let selectMode = $state(false);
	let selected = $state<string[]>([]);
	let refusal = $state<string | null>(null);
	const chosen = $derived(entries.filter((entry) => selected.includes(entry.lessonId)));
	const selectedIds = $derived(chosen.map((entry) => entry.lessonId));

	// Add Lesson's inline title field: `row` is the place it opens (the toolbar's, or a week row),
	// `afterLessonId` the Lesson the new one follows (none: the first untaught place).
	let adding = $state<{ row: number | 'tab'; afterLessonId: string | null } | null>(null);

	// A drag starts at a grip and uses pointer events, so one path serves a mouse and a finger. The
	// grip has `touch-action: none`; the rest of the card still lets a finger scroll the page. The
	// engine in `sequence-drag` hit-tests the cards on each move and each auto-scroll step, because a
	// Lesson can scroll under a pointer that is still. A fixed Lesson has no grip and no `data-drop`.
	let dragState = $state<DragSnapshot>({ ...AT_REST });
	const drag = createSequenceDrag({
		onChange: (snapshot) => (dragState = snapshot),
		onDrop: options.onDrop
	});
	const dragIds = $derived(dragState.ids);
	const overId = $derived(dragState.overId);
	const ghost = $derived(dragState.point);
	const dragging = $derived(dragState.ids.length > 0);
	const dragged = $derived(entries.find((entry) => entry.lessonId === dragState.grabbedId));
	const order = $derived(entries.map((entry) => entry.lessonId));
	// The new order if the drop happened now, or null when it would do nothing.
	const proposal = $derived(overId ? movedOrder(order, dragIds, overId) : null);
	// The drop line sits on the side of the target that the Lesson comes from.
	const lineAbove = $derived(!!overId && order.indexOf(overId) < order.indexOf(dragIds[0]));

	// By week: the Slots stay, and the Lessons that can still move go through them, as the order
	// lies now or, during a drag, as the drop would put them. Each Lesson that changes Slot is
	// outlined.
	const parts = $derived(new SvelteMap(entries.map((entry) => [entry.lessonId, entry.parts])));
	const slotKeys = $derived(movableSlotKeys(options.weeks()));
	const resting = $derived(layOutSequence(order, parts, slotKeys));
	const layout = $derived(proposal ? layOutSequence(proposal, parts, slotKeys) : resting);
	const diff = $derived(previewDiff(resting, layout, order));
	const changing = $derived(diff.changing);
	// The Lessons past the end of the year stay listed during a drag, so the card under a finger
	// is never removed; one that the drop would push out joins them.
	const pastEnd = $derived(diff.pastEndShown);

	function endSelect() {
		selectMode = false;
		selected = [];
		refusal = null;
	}

	function toggleSelect() {
		if (selectMode) endSelect();
		else selectMode = true;
	}

	// A tap on a Lesson in select mode. A fixed Lesson cannot be selected.
	function pick(entry: SequenceEntry) {
		if (entry.fixed) {
			refusal = `“${entry.title}” was taught, so it cannot be selected.`;
			return;
		}
		refusal = null;
		selected = selected.includes(entry.lessonId)
			? selected.filter((id) => id !== entry.lessonId)
			: [...selected, entry.lessonId];
	}

	// Select on a Topic chip: select mode on, and the Topic's untaught Lessons added.
	function selectTopic(topicId: string) {
		selectMode = true;
		refusal = null;
		const ids = entries.filter((e) => e.topicId === topicId && !e.fixed).map((e) => e.lessonId);
		selected = [...selected, ...ids.filter((id) => !selected.includes(id))];
	}

	// In select mode a tap on a card picks it, and never follows the link.
	function tap(event: MouseEvent, entry: SequenceEntry) {
		if (!selectMode) return;
		event.preventDefault();
		pick(entry);
	}

	// A failed Remove keeps the rest of the selection: only the Lessons that stayed selected go.
	function forget(lessonIds: string[]) {
		selected = selected.filter((id) => !lessonIds.includes(id));
	}

	function openAdd(row: number | 'tab', afterLessonId: string | null) {
		adding = { row, afterLessonId };
	}

	function closeAdd() {
		adding = null;
	}

	function start(event: PointerEvent, lessonId: string) {
		if (dragging || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0))
			return;
		event.preventDefault();
		// A drag on a picked Lesson carries the selection, in its order; any other carries one Lesson.
		const ids = selectMode && selectedIds.includes(lessonId) ? selectedIds : [lessonId];
		drag.start(event, ids, lessonId);
	}

	// Where the drop line sits on a row of the List layout, or null when it is not the target.
	function dropLine(lessonId: string): 'above' | 'below' | null {
		if (!dragging || !proposal || overId !== lessonId) return null;
		return lineAbove ? 'above' : 'below';
	}

	function remove(entry: SequenceEntry) {
		options.onRemove([entry]);
	}

	return {
		// Selection.
		get selectMode() {
			return selectMode;
		},
		get selectedIds() {
			return selectedIds;
		},
		get chosen() {
			return chosen;
		},
		get refusal() {
			return refusal;
		},
		toggleSelect,
		endSelect,
		selectTopic,
		tap,
		forget,
		// Add Lesson.
		get adding() {
			return adding;
		},
		openAdd,
		closeAdd,
		// Drag.
		get dragIds() {
			return dragIds;
		},
		get overId() {
			return overId;
		},
		get ghost() {
			return ghost;
		},
		get dragging() {
			return dragging;
		},
		get dragged() {
			return dragged;
		},
		start,
		move: drag.move,
		end: drag.end,
		dropLine,
		// Preview.
		get layout() {
			return layout;
		},
		get resting() {
			return resting;
		},
		get changing() {
			return changing;
		},
		get pastEnd() {
			return pastEnd;
		},
		get order() {
			return order;
		},
		// The last write.
		get ringed() {
			return ringed;
		},
		get was() {
			return was;
		},
		// The confirm dialog's request.
		remove
	};
}
