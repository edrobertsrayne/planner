<script lang="ts">
	import TagBadge from './tag-badge.svelte';

	// A Lesson's Tags, read-only, wherever a Lesson is displayed but not edited (Agenda, Courses
	// list, Planning, Session panel — issue #244). Renders nothing for an untagged Lesson. A
	// `<span>`, not a `<div>`: every caller places this inside a `<button>` (the Agenda row) or
	// another inline flow, and `flex`/`flex-wrap` lay it out identically either way.
	let { tags, class: className }: { tags: string[]; class?: string } = $props();
</script>

{#if tags.length}
	<span class="flex flex-wrap gap-1 {className ?? ''}">
		{#each tags as tag (tag)}
			<TagBadge name={tag} class="text-[10px]" />
		{/each}
	</span>
{/if}
