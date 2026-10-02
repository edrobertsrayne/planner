<script lang="ts">
	// Phone (< 768px), every variant: the Lesson editor becomes a read view. The phone is for
	// checking, not writing (map #303), so nothing here edits except stepping.
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import FileIcon from '@lucide/svelte/icons/file';
	import Markdown from '$lib/components/markdown.svelte';
	import TagChips from '$lib/components/tag-chips.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatSize, hostOf, topics, type FakeLesson } from './fake.svelte';

	let {
		lesson,
		index,
		count,
		onstep
	}: { lesson: FakeLesson; index: number; count: number; onstep: (delta: number) => void } =
		$props();

	const topic = $derived(topics.find((t) => t.id === lesson.topicId)!);
</script>

<article class="px-4 pt-3 pb-24">
	<div class="flex items-center justify-between">
		<Button
			variant="ghost"
			size="icon"
			disabled={index === 0}
			onclick={() => onstep(-1)}
			aria-label="Previous Lesson"
		>
			<ChevronLeftIcon />
		</Button>
		<span class="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
			Lesson {index + 1} of {count}
		</span>
		<Button
			variant="ghost"
			size="icon"
			disabled={index === count - 1}
			onclick={() => onstep(1)}
			aria-label="Next Lesson"
		>
			<ChevronRightIcon />
		</Button>
	</div>

	<p class="mt-2 text-xs text-muted-foreground">{topic.name}</p>
	<h1 class="mt-1 text-2xl font-semibold tracking-tight">{lesson.title}</h1>
	<div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
		<Badge variant={lesson.status === 'planned' ? 'default' : 'outline'}>
			{lesson.status === 'planned' ? 'Planned' : 'Draft'}
		</Badge>
		<span class="text-muted-foreground">{lesson.length} period{lesson.length === 1 ? '' : 's'}</span
		>
		<TagChips tags={lesson.tags} />
	</div>

	{#if lesson.links.length || lesson.attachments.length}
		<ul class="mt-5 divide-y rounded-lg border">
			{#each lesson.links as link (link.id)}
				<li>
					<a
						href={link.url}
						target="_blank"
						rel="noopener noreferrer"
						class="flex min-h-12 items-center gap-3 px-3 py-2 text-sm"
					>
						<ExternalLinkIcon class="size-4 shrink-0 text-muted-foreground" />
						<span class="min-w-0 flex-1">
							<span class="block truncate font-medium">{link.label}</span>
							<span class="block truncate text-xs text-muted-foreground">{hostOf(link.url)}</span>
						</span>
					</a>
				</li>
			{/each}
			{#each lesson.attachments as a (a.id)}
				<li class="flex min-h-12 items-center gap-3 px-3 py-2 text-sm">
					<FileIcon class="size-4 shrink-0 text-muted-foreground" />
					<span class="min-w-0 flex-1 truncate font-medium">{a.filename}</span>
					<span class="text-xs text-muted-foreground">{formatSize(a.size)}</span>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="mt-6">
		{#if lesson.body}
			<Markdown source={lesson.body} />
		{:else}
			<p class="text-sm text-muted-foreground">No plan yet.</p>
		{/if}
	</div>

	<p class="mt-10 text-center text-xs text-muted-foreground">Edit this Lesson on a laptop.</p>
</article>
