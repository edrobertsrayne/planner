<!--
	PROTOTYPE ONLY (issue #306): stands in for the Lesson editor page. Its layout is decided
	(issue #304); its address, stepping and Back are open (issue #308). Here Back returns to
	the page the teacher came from.
-->
<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import { Button } from '$lib/components/ui/button';
	import TagChips from '$lib/components/tag-chips.svelte';
	import type { Course, Lesson, Topic } from './store.svelte';

	let {
		course,
		topic,
		lesson,
		back
	}: { course: Course; topic: Topic; lesson: Lesson; back: string } = $props();
	const index = $derived(topic.lessons.indexOf(lesson));
</script>

<div class="mx-auto max-w-5xl px-6 py-6">
	<div class="mb-6 flex items-center gap-3 text-sm text-muted-foreground">
		<Button variant="ghost" size="sm" href={back}><ArrowLeftIcon />Back</Button>
		<span class="truncate">{course.name} › {topic.name}</span>
		<span class="ml-auto shrink-0">Lesson {index + 1} of {topic.lessons.length}</span>
	</div>
	<h1 class="text-xl font-semibold">{lesson.title}</h1>
	<TagChips tags={lesson.tags} class="mt-2" />
	<div
		class="mt-6 rounded-xl border border-dashed px-6 py-16 text-center text-sm text-muted-foreground"
	>
		The Lesson editor page goes here. Its layout is decided in “How should the Lesson editor be
		presented and laid out?”. This prototype only asks how the teacher gets here and back.
	</div>
</div>
