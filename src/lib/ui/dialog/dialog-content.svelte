<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import type { Snippet } from 'svelte';
	import type { HTMLDialogAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import { touchTarget } from '../touch-target';
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

	// A click on the dialog element itself is on its backdrop: the box is all children. It only
	// counts when the press began there too, so dragging a text selection out of a field and
	// releasing over the backdrop does not close the dialog and lose what was typed.
	let pressedBackdrop = false;
	function onpointerdown(e: PointerEvent) {
		pressedBackdrop = e.target === e.currentTarget;
	}
	function onclick(e: MouseEvent) {
		if (pressedBackdrop && e.target === e.currentTarget) ctx.setOpen(false);
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
		{onpointerdown}
		{onclick}
		{oncancel}
		class={cn('ui-dialog', side && `ui-dialog-${side}`, className)}
		{...rest}
	>
		<div class="ui-dialog-body">
			{@render children?.()}
		</div>
		{#if showCloseButton}
			<button
				type="button"
				class="ui-dialog-close absolute {touchTarget}"
				onclick={() => ctx.setOpen(false)}
			>
				<XIcon aria-hidden="true" />
				<span class="sr-only">Close</span>
			</button>
		{/if}
	</dialog>
{/if}
