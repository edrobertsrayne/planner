<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import { getPopoverContext } from '../popover/context';
	import { place, type Align, type Side } from '../popover/place';

	let {
		side = 'bottom',
		align = 'start',
		class: className,
		children,
		...rest
	}: HTMLAttributes<HTMLDivElement> & { side?: Side; align?: Align; children?: Snippet } = $props();

	const ctx = getPopoverContext();
	let el: HTMLDivElement;

	const items = () => [...el.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')];

	function ontoggle(e: Event) {
		const isOpen = (e as ToggleEvent).newState === 'open';
		if (isOpen) {
			const trigger = document.querySelector<HTMLElement>(`[popovertarget="${ctx.id}"]`);
			if (trigger) place(el, trigger, { side, align });
			items()[0]?.focus();
		}
		ctx.setOpen(isOpen);
	}

	function onkeydown(e: KeyboardEvent) {
		const all = items();
		const at = all.indexOf(document.activeElement as HTMLElement);
		const target =
			e.key === 'ArrowDown'
				? all[(at + 1) % all.length]
				: e.key === 'ArrowUp'
					? all[(at - 1 + all.length) % all.length]
					: e.key === 'Home'
						? all[0]
						: e.key === 'End'
							? all[all.length - 1]
							: null;
		if (!target) return;
		e.preventDefault();
		target.focus();
	}
</script>

<div
	bind:this={el}
	id={ctx.id}
	popover="auto"
	role="menu"
	tabindex="-1"
	{ontoggle}
	{onkeydown}
	class={cn('ui-popover ui-menu', className)}
	{...rest}
>
	{@render children?.()}
</div>
