<!--
	PROTOTYPE ONLY (issue #305): the room the shell keeps for a later search control (#265, out of
	scope). It does nothing; it shows where search would sit and how much room it takes.
-->
<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';

	let { compact = false, class: className = '' }: { compact?: boolean; class?: string } = $props();
</script>

{#if compact}
	<span
		class="inline-flex size-8 items-center justify-center rounded-md border border-dashed text-muted-foreground {className}"
		title="Search goes here later (#265)"
	>
		<SearchIcon class="size-4" />
	</span>
{:else}
	<span
		class="flex h-8 items-center gap-2 rounded-md border border-dashed px-2.5 text-sm text-muted-foreground {className}"
		title="Search goes here later (#265)"
	>
		<SearchIcon class="size-4 shrink-0" />
		<span class="truncate">Search (later)</span>
		<kbd class="ml-auto rounded border px-1 font-mono text-[10px]">⌘K</kbd>
	</span>
{/if}
