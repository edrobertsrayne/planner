<script lang="ts">
	// Variant A — "Document". The Lesson editor is its own page. One centred column that reads
	// top to bottom like the plan itself: title, a line of properties, the plan at full width and
	// full height (the page scrolls, never the editor), then Links, Attachments and Tags as
	// sections, then Detach and delete at the very end.
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import MarkdownEditor from '$lib/components/markdown-editor.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { course, taughtBy, topics, type FakeLesson } from './fake.svelte';
	import AttachmentsList from './parts/AttachmentsList.svelte';
	import LessonActions from './parts/LessonActions.svelte';
	import LengthField from './parts/LengthField.svelte';
	import LinksList from './parts/LinksList.svelte';
	import StatusToggle from './parts/StatusToggle.svelte';
	import Stepper from './parts/Stepper.svelte';
	import TagsEditor from './parts/TagsEditor.svelte';
	import TopicSelect from './parts/TopicSelect.svelte';

	let {
		lesson,
		index,
		count,
		onstep,
		onclose
	}: {
		lesson: FakeLesson;
		index: number;
		count: number;
		onstep: (delta: number) => void;
		onclose: () => void;
	} = $props();

	const topic = $derived(topics.find((t) => t.id === lesson.topicId)!);
</script>

<!-- page bar: way back on the left, place in the sequence on the right; sticks under the app header -->
<div class="sticky top-[49px] z-[6] border-b bg-background/95 backdrop-blur">
	<div class="mx-auto flex max-w-3xl items-center gap-2 px-6 py-2">
		<Button variant="ghost" size="sm" onclick={onclose}>
			<ArrowLeftIcon data-icon="inline-start" />
			Back
		</Button>
		<nav
			class="flex min-w-0 items-center gap-1 text-xs text-muted-foreground"
			aria-label="Breadcrumb"
		>
			<span class="max-w-48 truncate">{course.name}</span>
			<ChevronRightIcon class="size-3 shrink-0" />
			<span class="max-w-64 truncate">{topic.name}</span>
		</nav>
		<span class="ml-auto shrink-0"><Stepper {index} {count} {onstep} /></span>
	</div>
</div>

<article class="mx-auto max-w-3xl px-6 pt-6 pb-24">
	<input
		bind:value={lesson.title}
		class="w-full bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground"
		placeholder="Lesson title…"
		aria-label="Title"
	/>

	<!-- properties: one wrapping line, label beside control -->
	<div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
		<StatusToggle {lesson} />
		<label class="flex items-center gap-2">
			<span class="text-muted-foreground">Length</span>
			<LengthField {lesson} />
		</label>
		<label class="flex min-w-0 flex-1 basis-64 items-center gap-2">
			<span class="text-muted-foreground">Topic</span>
			<TopicSelect {lesson} />
		</label>
	</div>
	{#if taughtBy.length}
		<p class="mt-2 text-xs text-muted-foreground">Taught by {taughtBy.join(', ')}.</p>
	{/if}

	<section class="mt-8">
		<h2 class="mb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Plan</h2>
		{#key lesson.id}
			<MarkdownEditor
				value={lesson.body}
				label="Plan"
				placeholder="Objectives, what to set up, what went wrong last time…"
				toolbarClass="sticky top-[93px] z-[5] bg-muted"
				class="[&>div:last-of-type]:min-h-96 [&>div:last-of-type]:overflow-visible"
				onchange={(md) => (lesson.body = md)}
			/>
		{/key}
	</section>

	<section class="mt-10 grid gap-8 md:grid-cols-2">
		<div>
			<h2 class="mb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
				Links
			</h2>
			<LinksList {lesson} roomy />
		</div>
		<div>
			<h2 class="mb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
				Attachments
			</h2>
			<AttachmentsList {lesson} />
		</div>
	</section>

	<section class="mt-10">
		<h2 class="mb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Tags</h2>
		<TagsEditor {lesson} />
	</section>

	<section class="mt-12 border-t pt-6">
		<LessonActions explained />
	</section>
</article>
