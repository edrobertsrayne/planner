<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	import { setToggleGroupContext } from './context';

	let {
		value = $bindable(''),
		onValueChange,
		class: className,
		children
	}: {
		value?: string;
		onValueChange?: (value: string) => void;
		class?: string;
		children?: Snippet;
	} = $props();

	setToggleGroupContext({
		get value() {
			return value;
		},
		select(next) {
			if (next === value) return;
			value = next;
			onValueChange?.(next);
		}
	});

	// One Tab stop (the checked radio, by the item's roving tabindex); arrow keys move the choice
	// and select as they go, as a native radio group does.
	function onkeydown(e: KeyboardEvent & { currentTarget: HTMLElement }) {
		const radios = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')];
		const at = radios.indexOf(document.activeElement as HTMLElement);
		const step =
			e.key === 'ArrowRight' || e.key === 'ArrowDown'
				? 1
				: e.key === 'ArrowLeft' || e.key === 'ArrowUp'
					? -1
					: 0;
		if (!step || at < 0) return;
		e.preventDefault();
		const next = radios[(at + step + radios.length) % radios.length];
		next.focus();
		next.click();
	}
</script>

<!-- svelte-ignore a11y_interactive_supports_focus -->
<div role="radiogroup" {onkeydown} class={cn('ui-segmented', className)}>
	{@render children?.()}
</div>
