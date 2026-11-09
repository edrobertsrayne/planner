<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		...rest
	}: HTMLTextareaAttributes & { ref?: HTMLTextAreaElement | null } = $props();
</script>

<textarea bind:this={ref} class={cn('ui-input ui-textarea', className)} bind:value {...rest}
></textarea>
