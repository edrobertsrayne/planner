<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	let {
		class: className,
		variant = 'default',
		onSelect,
		disabled,
		children,
		...rest
	}: Omit<HTMLButtonAttributes, 'onselect'> & {
		variant?: 'default' | 'destructive';
		onSelect?: () => void;
	} = $props();

	function onclick(e: MouseEvent & { currentTarget: HTMLButtonElement }) {
		e.currentTarget.closest<HTMLElement>('[popover]')?.hidePopover();
		onSelect?.();
	}
</script>

<button
	type="button"
	role="menuitem"
	{disabled}
	{onclick}
	class={cn('ui-menu-item', variant === 'destructive' && 'ui-menu-item-destructive', className)}
	{...rest}
>
	{@render children?.()}
</button>
