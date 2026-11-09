<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { getPopoverContext } from '../popover/context';

	let {
		child,
		children,
		...rest
	}: HTMLButtonAttributes & { child?: Snippet<[{ props: Record<string, unknown> }]> } = $props();

	const ctx = getPopoverContext();
	const triggerProps = $derived({
		type: 'button',
		popovertarget: ctx.id,
		'aria-haspopup': 'menu',
		'aria-expanded': ctx.open,
		...rest
	});
</script>

{#if child}
	{@render child({ props: triggerProps })}
{:else}
	<button {...triggerProps as HTMLButtonAttributes}>{@render children?.()}</button>
{/if}
