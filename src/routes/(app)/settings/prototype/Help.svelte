<!-- PROTOTYPE ONLY (issue #314). Instruction text; `backticks` render as code. -->
<script lang="ts">
	import { cn } from '$lib/utils';

	let { text, class: className }: { text: string; class?: string } = $props();
	const parts = $derived(text.split('`'));
</script>

<p class={cn('text-sm text-muted-foreground', className)}>
	{#each parts as part, i (i)}
		{#if i % 2}<code class="rounded bg-muted px-1 py-0.5 font-mono text-xs">{part}</code
			>{:else}{part}{/if}
	{/each}
</p>
