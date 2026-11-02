<script lang="ts">
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import { touchTarget } from '$lib/components/ui/touch-target';

	// The grip a drag starts from, in the Sequence tab and a Topic's Lessons. It takes the pointer
	// itself (`touch-action: none`), so the rest of the row still lets a finger scroll the page.
	let {
		label,
		onstart,
		class: className = 'w-7'
	}: {
		// What the row is, for the aria-label: "Drag {label}".
		label: string;
		onstart: (event: PointerEvent) => void;
		// The grip's width and visibility at the call site.
		class?: string;
	} = $props();
</script>

<button
	type="button"
	class="{touchTarget} flex shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground {className}"
	aria-label="Drag {label}"
	onpointerdown={onstart}
>
	<GripVerticalIcon class="size-4" />
</button>
