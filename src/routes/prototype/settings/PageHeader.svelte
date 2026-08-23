<!--
	PROTOTYPE — throwaway. The shared page-header convention settled on #60: title and description
	left, actions right, replacing each screen's ad hoc container.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		back,
		actions,
		children
	}: {
		title?: string;
		description?: string;
		back?: Snippet;
		actions?: Snippet;
		children?: Snippet;
	} = $props();
</script>

<div class="flex flex-wrap items-start justify-between gap-3 pb-4">
	<div class="min-w-0">
		{#if back}{@render back()}{/if}
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
