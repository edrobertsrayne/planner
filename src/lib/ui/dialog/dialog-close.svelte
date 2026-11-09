<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { getDialogContext } from './context';

	let {
		child,
		children,
		...rest
	}: HTMLButtonAttributes & {
		child?: Snippet<[{ props: Record<string, unknown> }]>;
	} = $props();

	const ctx = getDialogContext();
	const triggerProps = $derived({ type: 'button', onclick: () => ctx.setOpen(false), ...rest });
</script>

{#if child}
	{@render child({ props: triggerProps })}
{:else}
	<button {...triggerProps as HTMLButtonAttributes}>{@render children?.()}</button>
{/if}
