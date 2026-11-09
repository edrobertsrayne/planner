<script lang="ts">
	import type { Snippet } from 'svelte';
	import { touchTarget } from '../touch-target';
	import { getToggleGroupContext } from './context';

	let { value, children }: { value: string; children?: Snippet } = $props();

	const ctx = getToggleGroupContext();
	const on = $derived(ctx.value === value);
</script>

<button
	type="button"
	role="radio"
	aria-checked={on}
	onclick={() => ctx.select(value)}
	class="ui-segment {touchTarget}"
>
	{@render children?.()}
</button>
