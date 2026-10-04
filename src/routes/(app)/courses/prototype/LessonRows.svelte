<!--
	PROTOTYPE ONLY (issue #306): one Topic's Lessons in order. Each title wraps (no truncation)
	and opens the Lesson editor. Reorder shows on hover from tablet up; Detach and delete live in
	the Lesson editor only. A phone shows the list only. `dense` drops the Tags and status column.
-->
<script lang="ts">
	import TagChips from '$lib/components/tag-chips.svelte';
	import CreateInput from './CreateInput.svelte';
	import MoveButtons from './MoveButtons.svelte';
	import { addLesson, to, type Course, type Topic } from './store.svelte';

	let {
		course,
		topic,
		dense = false
	}: { course: Course; topic: Topic; dense?: boolean } = $props();
</script>

<ol class="divide-y">
	{#each topic.lessons as lesson, i (lesson.id)}
		<li class="group flex items-start gap-3 px-3 py-2 hover:bg-muted/40">
			<span class="w-6 shrink-0 pt-0.5 text-right font-mono text-xs text-muted-foreground/70">
				{i + 1}
			</span>
			<a
				href={to({ course: course.id, topic: topic.id, lesson: lesson.id })}
				class="min-w-0 flex-1 text-sm hover:underline"
			>
				{lesson.title}
			</a>
			{#if !dense}
				<TagChips tags={lesson.tags} class="max-w-48 shrink-0 justify-end max-sm:hidden" />
				<span
					class="w-14 shrink-0 pt-0.5 text-right text-xs {lesson.status === 'Draft'
						? 'text-amber-600 dark:text-amber-400'
						: 'text-muted-foreground'}"
				>
					{lesson.status}
				</span>
			{/if}
			<span
				class="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 max-md:hidden"
			>
				<MoveButtons list={topic.lessons} index={i} label={lesson.title} />
			</span>
		</li>
	{/each}
	{#if !topic.lessons.length}
		<li class="px-3 py-3 text-sm text-muted-foreground">No Lessons yet.</li>
	{/if}
</ol>
<CreateInput
	class="px-3 pt-3"
	placeholder="New Lesson title — press Enter"
	oncreate={(v) => addLesson(topic, v)}
/>
