<!--
	The platform's own <select>: it brings the keyboard, the touch picker and the combobox role, and
	needs nothing built on top. `options` is the whole list; `value` is the chosen option's value.
-->
<script lang="ts" module>
	export interface SelectOption {
		value: string;
		label: string;
	}
</script>

<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { cn } from '$lib/utils';
	import type { HTMLSelectAttributes } from 'svelte/elements';

	let {
		value = $bindable(''),
		options,
		onValueChange,
		class: className,
		...rest
	}: Omit<HTMLSelectAttributes, 'value' | 'children'> & {
		value?: string;
		options: readonly SelectOption[];
		onValueChange?: (value: string) => void;
	} = $props();
</script>

<span class={cn('ui-select', className)}>
	<select bind:value onchange={() => onValueChange?.(value)} {...rest}>
		{#each options as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
	<ChevronDownIcon aria-hidden="true" />
</span>
