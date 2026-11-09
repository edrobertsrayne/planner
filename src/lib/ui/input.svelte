<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		ref = $bindable(null),
		value = $bindable(),
		files = $bindable(),
		class: className,
		type,
		...rest
	}: Omit<HTMLInputAttributes, 'type'> & {
		type?: HTMLInputAttributes['type'];
		ref?: HTMLInputElement | null;
		files?: FileList;
	} = $props();
</script>

{#if type === 'file'}
	<input
		bind:this={ref}
		class={cn('ui-input', className)}
		type="file"
		bind:files
		bind:value
		{...rest}
	/>
{:else}
	<input bind:this={ref} class={cn('ui-input', className)} {type} bind:value {...rest} />
{/if}
