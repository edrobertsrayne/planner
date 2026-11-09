<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	import { touchTarget } from '../touch-target';
	import { getTabsContext } from './context';

	let {
		value,
		class: className,
		children
	}: { value: string; class?: string; children?: Snippet } = $props();

	const ctx = getTabsContext();
	const selected = $derived(ctx.value === value);
</script>

<button
	type="button"
	role="tab"
	aria-selected={selected}
	tabindex={selected ? 0 : -1}
	onclick={() => ctx.select(value)}
	class={cn('ui-tab', touchTarget, className)}
>
	{@render children?.()}
</button>
