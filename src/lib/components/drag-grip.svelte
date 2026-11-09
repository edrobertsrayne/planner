<script lang="ts">
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import { touchTarget } from '$lib/ui';

	// The grip a drag starts from, in the Sequence tab and a Topic's Lessons. It takes the pointer
	// itself (`touch-action: none`), so the rest of the row still lets a finger scroll the page.
	// With `onmove`, the focused grip also moves its row one place on the up and down arrow keys,
	// so a keyboard can reorder what a pointer drags.
	let {
		label,
		onstart,
		onmove,
		class: className = 'w-7'
	}: {
		// What the row is, for the aria-label: "Drag {label}".
		label: string;
		onstart: (event: PointerEvent) => void;
		onmove?: (direction: 'up' | 'down') => void;
		// The grip's width and visibility at the call site.
		class?: string;
	} = $props();

	function onkeydown(event: KeyboardEvent) {
		const direction = { ArrowUp: 'up', ArrowDown: 'down' } as const;
		const move = direction[event.key as keyof typeof direction];
		if (!onmove || !move) return;
		event.preventDefault();
		onmove(move);
	}
</script>

<button
	type="button"
	class="{touchTarget} flex shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground {className}"
	aria-label="Drag {label}"
	aria-keyshortcuts={onmove ? 'ArrowUp ArrowDown' : undefined}
	onpointerdown={onstart}
	{onkeydown}
>
	<GripVerticalIcon class="size-4" />
</button>
