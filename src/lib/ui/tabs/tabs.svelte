<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { setTabsContext } from './context';

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
	} & Omit<HTMLAttributes<HTMLDivElement>, 'children'> = $props();

	setTabsContext({
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

<div class={className}>{@render children?.()}</div>
