<script lang="ts">
	import { topics, type FakeLesson } from '../fake.svelte';

	let { lesson, class: className }: { lesson: FakeLesson; class?: string } = $props();
</script>

<select
	bind:value={lesson.topicId}
	aria-label="Topic"
	class="w-full min-w-0 truncate rounded-md border border-input bg-background px-2 py-1 text-sm {className ??
		''}"
>
	{#each topics as t (t.id)}
		<option value={t.id}>{t.name}</option>
	{/each}
</select>
