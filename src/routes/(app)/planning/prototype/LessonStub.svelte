<!--
	PROTOTYPE ONLY (issue #307): stands in for the Lesson editor page. Its layout is decided
	(issue #304); its address, stepping and Back are open (issue #308). Here Back returns to the
	Planning screen with the same Class filter.
-->
<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import { Button } from '$lib/components/ui/button';
	import TagChips from '$lib/components/tag-chips.svelte';
	import { to, type Lesson } from './store.svelte';

	let { lesson }: { lesson: Lesson } = $props();
</script>

<div class="mx-auto max-w-5xl px-4 py-6 md:px-6">
	<div class="mb-6 flex items-center gap-3 text-sm text-muted-foreground">
		<Button variant="ghost" size="sm" href={to({ lesson: null })}><ArrowLeftIcon />Planning</Button>
		<span class="truncate">
			{lesson.topicName ? `${lesson.courseName} › ${lesson.topicName}` : 'Standalone Lesson'}
		</span>
	</div>
	<h1 class="text-xl font-semibold">{lesson.title}</h1>
	<TagChips tags={lesson.tags} class="mt-2" />
	<div
		class="mt-6 rounded-xl border border-dashed px-6 py-16 text-center text-sm text-muted-foreground"
	>
		{#if lesson.topicName}
			The Lesson editor page goes here (“How should the Lesson editor be presented and laid out?”).
			This prototype only asks how the teacher gets here from Planning.
		{:else}
			A Standalone Lesson. Today its row opens the Session panel, because a Standalone Lesson
			reaches no Lesson editor. “Can a placed Standalone Lesson be written in the Lesson editor?”
			decides where this row leads.
		{/if}
	</div>
</div>
