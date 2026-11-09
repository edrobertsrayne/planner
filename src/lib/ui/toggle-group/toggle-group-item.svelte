<script lang="ts">
	import type { Snippet } from 'svelte';
	import { touchTarget } from '../touch-target';
	import { getToggleGroupContext } from './context';

	let { value, tone, children }: { value: string; tone?: 'ready'; children?: Snippet } = $props();

	const ctx = getToggleGroupContext();
	const on = $derived(ctx.value === value);
</script>

<button
	type="button"
	role="radio"
	aria-checked={on}
	onclick={() => ctx.select(value)}
	class="ui-segment {tone ? `ui-segment-${tone}` : ''} {touchTarget}"
>
	{@render children?.()}
</button>
