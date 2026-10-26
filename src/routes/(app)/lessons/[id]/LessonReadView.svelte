<script lang="ts">
	import LessonChildren from '$lib/components/lesson-children.svelte';
	import Markdown from '$lib/components/markdown.svelte';
	import TagBadge from '$lib/components/tag-badge.svelte';
	import type { LessonDetail } from '$lib/server/planner';

	// The Lesson as a phone reads it (#428): its title, the facts, the plan, and its Links and
	// Attachments. No control here changes the Lesson, which is why it is a component of its own
	// beside the editor that the wider window opens.
	let { lesson }: { lesson: LessonDetail } = $props();
</script>

<div class="mt-3 space-y-3">
	<h1 class="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
	<dl class="space-y-2">
		{#if lesson.topic}
			<div class="flex min-h-12 items-center justify-between gap-3 rounded-lg border px-4 py-2">
				<dt class="text-muted-foreground">Topic</dt>
				<dd class="min-w-0 truncate">{lesson.topic.name}</dd>
			</div>
		{/if}
		<div class="flex min-h-12 items-center justify-between gap-3 rounded-lg border px-4 py-2">
			<dt class="text-muted-foreground">Status</dt>
			<dd>{lesson.status === 'planned' ? 'Planned' : 'Draft'}</dd>
		</div>
		<div class="flex min-h-12 items-center justify-between gap-3 rounded-lg border px-4 py-2">
			<dt class="text-muted-foreground">Length</dt>
			<dd>{lesson.length} {lesson.length === 1 ? 'Period' : 'Periods'}</dd>
		</div>
		{#if lesson.tags.length}
			<div class="flex min-h-12 flex-wrap items-center gap-1 rounded-lg border px-4 py-2">
				{#each lesson.tags as tag (tag.id)}
					<TagBadge name={tag.name} />
				{/each}
			</div>
		{/if}
	</dl>

	{#if lesson.body}
		<Markdown source={lesson.body} class="rounded-lg border px-4 py-3" />
	{/if}

	<LessonChildren links={lesson.links} attachments={lesson.attachments} variant="rows" />
</div>
