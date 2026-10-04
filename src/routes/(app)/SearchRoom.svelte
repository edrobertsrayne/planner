<!-- Room kept for a later search control (#265). It does nothing. -->
<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';

	let { compact = false, class: className = '' }: { compact?: boolean; class?: string } = $props();
</script>

<span
	aria-hidden="true"
	class="flex items-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground {compact
		? 'size-8 justify-center'
		: 'h-8 px-2.5'} {className}"
>
	<SearchIcon class="size-4 shrink-0" />
	{#if !compact}<span class="truncate">Search</span>{/if}
</span>
