<script lang="ts">
	// Variant C — "Wide side panel". Not a page: the Lesson editor slides in from the right over
	// the Courses screen and leaves the Topic's Lesson list in view and clickable, so the teacher
	// keeps their place and can jump to any Lesson. The panel scrolls on its own. Links,
	// Attachments and Tags fold into sections with counts, open by default. Below `lg` the panel
	// takes the full width.
	import XIcon from '@lucide/svelte/icons/x';
	import MarkdownEditor from '$lib/components/markdown-editor.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { taughtBy, type FakeLesson } from './fake.svelte';
	import AttachmentsList from './parts/AttachmentsList.svelte';
	import CoursesBackdrop from './CoursesBackdrop.svelte';
	import LessonActions from './parts/LessonActions.svelte';
	import LengthField from './parts/LengthField.svelte';
	import LinksList from './parts/LinksList.svelte';
	import StatusToggle from './parts/StatusToggle.svelte';
	import Stepper from './parts/Stepper.svelte';
	import TagsEditor from './parts/TagsEditor.svelte';
	import TopicSelect from './parts/TopicSelect.svelte';

	let {
		lesson,
		open,
		index,
		count,
		onstep,
		onclose,
		onopen
	}: {
		lesson: FakeLesson;
		open: boolean;
		index: number;
		count: number;
		onstep: (delta: number) => void;
		onclose: () => void;
		onopen: (id: string) => void;
	} = $props();
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && open) onclose();
	}}
/>

<CoursesBackdrop selectedId={open ? lesson.id : null} {onopen} besidePanel={open} />

{#snippet section(title: string, n: number | null, body: import('svelte').Snippet)}
	<details open class="group border-t px-6 py-3">
		<summary
			class="flex cursor-pointer list-none items-center gap-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase select-none"
		>
			<span class="transition-transform group-open:rotate-90">›</span>
			{title}
			{#if n !== null}<span class="font-normal normal-case">({n})</span>{/if}
		</summary>
		<div class="mt-2">{@render body()}</div>
	</details>
{/snippet}

{#if open}
	<aside
		class="fixed top-[49px] right-0 bottom-0 z-20 flex w-full flex-col border-l bg-background shadow-2xl lg:w-[min(52rem,60vw)]"
		aria-label="Lesson editor"
	>
		<header class="flex items-center gap-2 border-b px-6 py-2">
			<Stepper {index} {count} {onstep} />
			<Button variant="ghost" size="icon-sm" class="ml-auto" aria-label="Close" onclick={onclose}>
				<XIcon class="size-3.5" />
			</Button>
		</header>

		<div class="min-h-0 flex-1 overflow-y-auto">
			<div class="px-6 pt-4 pb-4">
				<input
					bind:value={lesson.title}
					class="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground"
					placeholder="Lesson title…"
					aria-label="Title"
				/>
				<div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
					<StatusToggle {lesson} />
					<label class="flex items-center gap-2">
						<span class="text-muted-foreground">Length</span>
						<LengthField {lesson} />
					</label>
					<label class="flex min-w-0 flex-1 basis-56 items-center gap-2">
						<span class="text-muted-foreground">Topic</span>
						<TopicSelect {lesson} />
					</label>
				</div>
				{#if taughtBy.length}
					<p class="mt-2 text-xs text-muted-foreground">Taught by {taughtBy.join(', ')}.</p>
				{/if}

				<div class="mt-5">
					{#key lesson.id}
						<MarkdownEditor
							value={lesson.body}
							label="Plan"
							placeholder="Objectives, what to set up, what went wrong last time…"
							toolbarClass="sticky top-0 z-[5] bg-muted"
							class="[&>div:last-of-type]:min-h-80 [&>div:last-of-type]:overflow-visible"
							onchange={(md) => (lesson.body = md)}
						/>
					{/key}
				</div>
			</div>

			{#snippet tags()}<TagsEditor {lesson} />{/snippet}
			{#snippet links()}<LinksList {lesson} roomy />{/snippet}
			{#snippet attachments()}<AttachmentsList {lesson} />{/snippet}
			{@render section('Tags', lesson.tags.length, tags)}
			{@render section('Links', lesson.links.length, links)}
			{@render section('Attachments', lesson.attachments.length, attachments)}
		</div>

		<footer class="flex items-center justify-between border-t px-4 py-2">
			<span class="text-xs text-muted-foreground">Saved</span>
			<LessonActions />
		</footer>
	</aside>
{/if}
