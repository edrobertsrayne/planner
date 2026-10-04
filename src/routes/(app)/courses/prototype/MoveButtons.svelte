<!-- PROTOTYPE ONLY (issue #306): move one row up or down in a local list. -->
<script lang="ts">
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { Button } from '$lib/components/ui/button';
	import { move } from './store.svelte';

	let { list, index, label }: { list: unknown[]; index: number; label: string } = $props();
</script>

<Button
	variant="ghost"
	size="icon-sm"
	disabled={index === 0}
	aria-label="Move {label} up"
	onclick={() => move(list, index, -1)}
>
	<ChevronUpIcon class="size-3.5" />
</Button>
<Button
	variant="ghost"
	size="icon-sm"
	disabled={index === list.length - 1}
	aria-label="Move {label} down"
	onclick={() => move(list, index, 1)}
>
	<ChevronDownIcon class="size-3.5" />
</Button>
