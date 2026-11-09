<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	let {
		side = 'top',
		class: className,
		children
	}: { side?: 'top' | 'right'; class?: string; children?: Snippet } = $props();
</script>

<span
	role="tooltip"
	data-slot="tooltip-content"
	class={cn('ui-tip-content', `ui-tip-${side}`, className)}
>
	{@render children?.()}
</span>
