<script lang="ts">
	// Variant D — "Big modal with tabs". Keeps today's modal over the Courses screen but makes it
	// nearly fill the window, and splits the Lesson into three tabs so no tab has to share room:
	// Plan (the editor fills the whole body), Resources (Links and Attachments side by side, with
	// a drop target) and Details (Length, Topic, Tags, Detach and delete). Title, Draft/Planned
	// and stepping stay in the header on every tab. Nothing scrolls but the active tab's body.
	import XIcon from '@lucide/svelte/icons/x';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
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

	type Tab = 'plan' | 'resources' | 'details';
	let tab = $state<Tab>('plan');

	const TABS = $derived<{ key: Tab; label: string }[]>([
		{ key: 'plan', label: 'Plan' },
		{ key: 'resources', label: `Resources (${lesson.links.length + lesson.attachments.length})` },
		{ key: 'details', label: 'Details' }
	]);
</script>

<CoursesBackdrop selectedId={open ? lesson.id : null} {onopen} />

<Dialog.Root
	{open}
	onOpenChange={(o) => {
		if (!o) onclose();
	}}
>
	<Dialog.Content
		class="flex h-[92vh] w-[95vw] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl"
		showCloseButton={false}
	>
		<Dialog.Title class="sr-only">Edit Lesson</Dialog.Title>

		<header class="border-b px-6 pt-3">
			<div class="flex items-center gap-3">
				<Stepper {index} {count} {onstep} />
				<Button variant="ghost" size="icon-sm" class="ml-auto" aria-label="Close" onclick={onclose}>
					<XIcon class="size-3.5" />
				</Button>
			</div>
			<div class="mt-1 flex flex-wrap items-center gap-4">
				<input
					bind:value={lesson.title}
					class="min-w-0 flex-1 basis-80 bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground"
					placeholder="Lesson title…"
					aria-label="Title"
				/>
				<StatusToggle {lesson} />
			</div>
			<div class="mt-3 -mb-px flex gap-1" role="tablist">
				{#each TABS as t (t.key)}
					<button
						type="button"
						role="tab"
						aria-selected={tab === t.key}
						class="border-b-2 px-3 py-2 text-sm font-medium transition-colors {tab === t.key
							? 'border-foreground text-foreground'
							: 'border-transparent text-muted-foreground hover:text-foreground'}"
						onclick={() => (tab = t.key)}
					>
						{t.label}
					</button>
				{/each}
			</div>
		</header>

		<div class="min-h-0 flex-1 overflow-y-auto">
			{#if tab === 'plan'}
				<div class="flex h-full flex-col px-6 py-4">
					{#key lesson.id}
						<MarkdownEditor
							value={lesson.body}
							label="Plan"
							placeholder="Objectives, what to set up, what went wrong last time…"
							class="min-h-0 flex-1"
							onchange={(md) => (lesson.body = md)}
						/>
					{/key}
				</div>
			{:else if tab === 'resources'}
				<div class="grid gap-8 px-6 py-5 md:grid-cols-2">
					<section>
						<h2 class="mb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
							Links
						</h2>
						<LinksList {lesson} roomy />
					</section>
					<section>
						<h2 class="mb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
							Attachments
						</h2>
						<AttachmentsList {lesson} dropzone />
					</section>
				</div>
			{:else}
				<div class="mx-auto max-w-2xl space-y-6 px-6 py-5">
					<div class="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-x-4 gap-y-4 text-sm">
						<span class="text-muted-foreground">Length</span>
						<LengthField {lesson} />
						<span class="text-muted-foreground">Topic</span>
						<TopicSelect {lesson} />
						{#if taughtBy.length}
							<span class="text-muted-foreground">Taught by</span>
							<span>{taughtBy.join(', ')}</span>
						{/if}
						<span class="self-start pt-1 text-muted-foreground">Tags</span>
						<div><TagsEditor {lesson} /></div>
					</div>
					<div class="border-t pt-5">
						<LessonActions explained />
					</div>
				</div>
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
