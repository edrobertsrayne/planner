<script lang="ts">
	// The hidden field that names a Link's or an Attachment's owner, a Lesson or a Class (ADR-0032).
	let { owner }: { owner: { lessonId: string } | { classId: string } } = $props();
</script>

{#each Object.entries(owner) as [name, value] (name)}
	<input type="hidden" {name} {value} />
{/each}
