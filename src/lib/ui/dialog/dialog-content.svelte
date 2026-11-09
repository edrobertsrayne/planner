<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import type { Snippet } from 'svelte';
	import type { HTMLDialogAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import { getDialogContext } from './context';

	let {
		class: className,
		side,
		showCloseButton = true,
		children,
		...rest
	}: HTMLDialogAttributes & {
		// A drawer is anchored to this edge and fills its height; omitted, the dialog is centred.
		side?: 'left';
		showCloseButton?: boolean;
		children?: Snippet;
	} = $props();

	const ctx = getDialogContext();

	function modal(node: HTMLDialogElement) {
		node.showModal();
	}

	// A click that lands on the dialog element itself is on its backdrop: the box is all children.
	function onclick(e: MouseEvent) {
		if (e.target === e.currentTarget) ctx.setOpen(false);
	}

	// Escape closes through the binding rather than the browser, so state and DOM stay one thing.
	function oncancel(e: Event) {
		e.preventDefault();
		ctx.setOpen(false);
	}
</script>

{#if ctx.open}
	<dialog
		{@attach modal}
		aria-labelledby={ctx.titleId}
		aria-describedby={ctx.descriptionId}
		{onclick}
		{oncancel}
		class={cn('ui-dialog', side && `ui-dialog-${side}`, className)}
		{...rest}
	>
		<div class="ui-dialog-body">
			{@render children?.()}
		</div>
		{#if showCloseButton}
			<button type="button" class="ui-dialog-close" onclick={() => ctx.setOpen(false)}>
				<XIcon aria-hidden="true" />
				<span class="sr-only">Close</span>
			</button>
		{/if}
	</dialog>
{/if}
