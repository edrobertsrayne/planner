<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import { getPopoverContext } from './context';
	import { place, type Align, type Side } from './place';

	let {
		side = 'bottom',
		align = 'center',
		class: className,
		children,
		...rest
	}: HTMLAttributes<HTMLDivElement> & { side?: Side; align?: Align; children?: Snippet } = $props();

	const ctx = getPopoverContext();
	let el: HTMLDivElement;

	// `open` is the caller's to set; the DOM's toggle event is how the browser reports its own
	// dismissals back.
	$effect(() => {
		if (ctx.open && !el.matches(':popover-open')) el.showPopover();
		else if (!ctx.open && el.matches(':popover-open')) el.hidePopover();
	});

	function ontoggle(e: Event) {
		const isOpen = (e as ToggleEvent).newState === 'open';
		if (isOpen) {
			const trigger = document.querySelector<HTMLElement>(`[popovertarget="${ctx.id}"]`);
			if (trigger) place(el, trigger, { side, align });
		}
		ctx.setOpen(isOpen);
	}
</script>

<div
	bind:this={el}
	id={ctx.id}
	popover="auto"
	{ontoggle}
	class={cn('ui-popover', className)}
	{...rest}
>
	{@render children?.()}
</div>
