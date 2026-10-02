<script lang="ts">
	// Variant B — "Page with a property rail". The Lesson editor is its own page, split in two:
	// the plan takes the wide left column and grows with its content (the page scrolls), while a
	// right-hand rail holds every short field — Draft/Planned, Length, Topic, Tags, Links,
	// Attachments, Detach and delete. Nothing is pinned: the rail scrolls with the page. Below
	// `lg` the status card sits under the title and the rest of the rail follows the plan.
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

{#snippet heading(text: string)}
	<h2 class="mb-1.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
		{text}
	</h2>
{/snippet}

<div class="mx-auto max-w-6xl px-6 pt-4 pb-24">
	<div class="flex items-center gap-2">
		<Button variant="ghost" size="sm" class="-ml-3" onclick={onclose}>
			<ArrowLeftIcon data-icon="inline-start" />
			Back
		</Button>
		<nav
			class="flex min-w-0 items-center gap-1 text-xs text-muted-foreground"
			aria-label="Breadcrumb"
		>
			<span class="max-w-60 truncate">{course.name}</span>
			<ChevronRightIcon class="size-3 shrink-0" />
			<span class="max-w-80 truncate">{topic.name}</span>
		</nav>
		<span class="ml-auto shrink-0"><Stepper {index} {count} {onstep} /></span>
	</div>

	<!-- Below `lg` the columns and the rail dissolve (`contents`) into one stack, so `order` can
	     put the status card between the title and the plan, and the rest of the rail after it. -->
	<div class="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
		<!-- main column: title and plan -->
		<div class="min-w-0 max-lg:contents">
			<input
				bind:value={lesson.title}
				class="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground max-lg:order-1"
				placeholder="Lesson title…"
				aria-label="Title"
			/>
			<div class="mt-4 max-lg:order-3 max-lg:mt-0 max-lg:min-w-0">
				{#key lesson.id}
					<MarkdownEditor
						value={lesson.body}
						label="Plan"
						placeholder="Objectives, what to set up, what went wrong last time…"
						toolbarClass="sticky top-[49px] z-[5] bg-muted"
						class="[&>div:last-of-type]:min-h-[28rem] [&>div:last-of-type]:overflow-visible"
						onchange={(md) => (lesson.body = md)}
					/>
				{/key}
			</div>
		</div>

		<!-- rail: scrolls with the page on laptop; below `lg` it dissolves into the stack — status
		     card under the title, the rest after the plan -->
		<aside class="min-w-0 space-y-5 max-lg:contents max-lg:space-y-0 lg:self-start">
			<div class="space-y-5 max-lg:contents max-lg:space-y-0">
				<div
					class="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 rounded-lg border p-3 text-sm max-lg:order-2"
				>
					<span class="text-muted-foreground">Status</span>
					<StatusToggle {lesson} />
					<span class="text-muted-foreground">Length</span>
					<LengthField {lesson} />
					<span class="text-muted-foreground">Topic</span>
					<TopicSelect {lesson} />
					{#if taughtBy.length}
						<span class="text-muted-foreground">Taught by</span>
						<span class="text-xs">{taughtBy.join(', ')}</span>
					{/if}
				</div>

				<section class="max-lg:order-4">
					{@render heading('Tags')}
					<TagsEditor {lesson} />
				</section>
			</div>

			<div class="grid gap-5 max-lg:order-4 sm:grid-cols-2 lg:grid-cols-1">
				<section>
					{@render heading('Links')}
					<LinksList {lesson} />
				</section>
				<section>
					{@render heading('Attachments')}
					<AttachmentsList {lesson} />
				</section>
			</div>

			<div class="border-t pt-3 max-lg:order-4">
				<LessonActions />
			</div>
		</aside>
	</div>
</div>
