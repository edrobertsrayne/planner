<script lang="ts">
	import { resolve } from '$app/paths';
	import CheckIcon from '@lucide/svelte/icons/check';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import LockIcon from '@lucide/svelte/icons/lock';
	import XIcon from '@lucide/svelte/icons/x';
	import Markdown from '$lib/components/markdown.svelte';
	import { touchTarget } from '$lib/components/ui/touch-target';
	import { formatDateShort } from '$lib/date';
	import { wasText } from '$lib/sequence-text';
	import { topicColour } from '$lib/topic-colour';
	import TopicTag from './TopicTag.svelte';
	import type { SequenceEntry } from '$lib/server/planner';

	// One row of the Sequence tab's List layout (#428): the Lesson's card, its grip and its remove
	// button. The tab owns the drag, selection and write; this file only draws one row.
	let {
		classId,
		entry,
		selected,
		dragging,
		ringed,
		was = undefined,
		selectMode,
		dropLine,
		onTap,
		onGrip,
		onRemove
	}: {
		classId: string;
		entry: SequenceEntry;
		selected: boolean;
		// A drag is on: the row being carried fades.
		dragging: boolean;
		// The Lessons just moved: the row gets a ring.
		ringed: boolean;
		// The Lesson's old first date, when the last write moved it.
		was?: string | null;
		selectMode: boolean;
		// Where the drop line sits, or null when this row is not the drop target.
		dropLine: 'above' | 'below' | null;
		onTap: (event: MouseEvent, entry: SequenceEntry) => void;
		onGrip: (event: PointerEvent, lessonId: string) => void;
		onRemove: (entry: SequenceEntry) => void;
	} = $props();
</script>

<li
	class="relative flex items-stretch {dragging ? 'opacity-40' : ''} {selected
		? 'ring-2 ring-primary ring-inset'
		: ''} {!dragging && ringed ? 'ring-2 ring-amber-500 ring-inset' : ''}"
	style:background-color={topicColour(entry.topicId, selected ? 0.45 : 0.12)}
	data-drop={entry.fixed ? undefined : entry.lessonId}
	data-selected={selected ? '' : undefined}
>
	{#if dropLine}
		<span
			class="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-primary {dropLine === 'above'
				? '-top-px'
				: '-bottom-px'}"
			data-drop-line
		></span>
	{/if}
	{#if entry.fixed}
		<span class="w-7 shrink-0"></span>
	{:else}
		<button
			type="button"
			class="{touchTarget} flex w-7 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground"
			aria-label="Drag {entry.title}"
			onpointerdown={(event) => onGrip(event, entry.lessonId)}
		>
			<GripVerticalIcon class="size-4" />
		</button>
	{/if}
	<a
		href={resolve(`/lessons/${entry.lessonId}?class=${classId}`)}
		class="flex min-w-0 flex-1 flex-col gap-1 px-3 py-2 hover:bg-muted/40"
		onclick={(event) => onTap(event, entry)}
	>
		<span class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
			<span class="text-sm font-medium" data-title>{entry.title}</span>
			{#if selected}
				<CheckIcon class="size-3.5 self-center text-primary" aria-label="Selected" />
			{/if}
			{#if entry.topicName}
				<TopicTag
					topicId={entry.topicId}
					name={entry.topicName}
					class="gap-1.5 text-xs text-muted-foreground"
				/>
			{/if}
			<span class="ml-auto flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
				{#if entry.ready}
					<span class="flex items-center gap-0.5" data-ready>
						<CheckIcon class="size-3" aria-hidden="true" />Ready
					</span>
				{/if}
				{#if entry.fixed}
					<LockIcon class="size-3" aria-label="Fixed: already taught" />
				{/if}
				{#if !dragging && was !== undefined}
					<span class="text-amber-700 dark:text-amber-400" data-was>
						{wasText(was)}
					</span>
				{/if}
				{entry.firstDate ? formatDateShort(entry.firstDate) : 'past the end'}
			</span>
		</span>
		{#if entry.note}
			<Markdown source={entry.note} class="line-clamp-2 text-xs text-muted-foreground" />
		{/if}
	</a>
	{#if !entry.fixed && !selectMode}
		<button
			type="button"
			class="flex items-center px-3 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
			aria-label={`Remove ${entry.title}`}
			onclick={() => onRemove(entry)}
		>
			<XIcon class="size-4" aria-hidden="true" />
		</button>
	{/if}
</li>
