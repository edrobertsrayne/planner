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
</script>

<div role="radiogroup" class={cn('ui-segmented', className)}>{@render children?.()}</div>
