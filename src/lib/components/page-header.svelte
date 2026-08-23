<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	let {
		title,
		description,
		actions,
		children,
		class: className
	}: {
		title?: string;
		description?: string;
		actions?: Snippet;
		children?: Snippet;
		class?: string;
	} = $props();
</script>

<div class={cn('flex flex-wrap items-start justify-between gap-3 pb-4', className)}>
	<div class="min-w-0">
		{#if children}
			{@render children()}
		{:else}
			<h1 class="text-lg font-semibold tracking-tight">{title}</h1>
		{/if}
		{#if description}
			<p class="mt-1 text-sm text-muted-foreground">{description}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex shrink-0 items-center gap-2">{@render actions()}</div>
	{/if}
</div>
