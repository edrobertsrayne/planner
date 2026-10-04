<!--
	PROTOTYPE ONLY (issue #312). One Session's tile, as the real Calendar draws it. `size` trims it:
	`full` is today's tile, `row` lays it out for a list, `mini` shows only the Class (and the title
	if it fits).
-->
<script lang="ts">
	import { classTone } from '$lib/class-tone';
	import { openSession, type Cell } from './store.svelte';

	let {
		cell,
		size = 'full',
		class: klass = ''
	}: { cell: Cell; size?: 'full' | 'row' | 'mini'; class?: string } = $props();

	const tone = $derived(classTone(cell.row.tone));
	const lesson = $derived(cell.row.lesson);
	const periods = $derived(
		cell.row.periodFrom === cell.row.periodTo
			? `P${cell.row.periodFrom}`
			: `P${cell.row.periodFrom}–${cell.row.periodTo}`
	);
</script>

{#if cell.kind === 'blocked'}
	<div
		class="hatched flex h-full flex-col rounded-lg border border-dashed px-2 py-1.5 {size === 'row'
			? 'min-h-11 flex-row items-center gap-3'
			: 'min-h-16'} {klass}"
	>
		<span class="text-xs font-semibold text-muted-foreground">{cell.row.classLabel}</span>
		{#if size !== 'mini'}
			<span class="line-clamp-2 text-xs text-muted-foreground/80 italic">{cell.note}</span>
		{/if}
	</div>
{:else}
	<button
		type="button"
		class="relative flex h-full w-full min-w-0 overflow-hidden rounded-lg border text-left {size ===
		'row'
			? 'min-h-11 items-center gap-3 px-3 py-2'
			: size === 'mini'
				? 'min-h-11 flex-col px-1.5 py-1'
				: 'min-h-16 flex-col px-2 py-1.5'} {klass}"
		style:background-color={tone.bg}
		style:border-color={tone.ring}
		onclick={() => openSession(cell.row)}
	>
		{#if size === 'row'}
			<span class="w-14 shrink-0 text-xs font-semibold" style:color={tone.fg}
				>{cell.row.classLabel}</span
			>
			<span class="min-w-0 flex-1" style:color={tone.fg}>
				{#if lesson}
					<span class="block truncate text-sm font-medium">{lesson.title}</span>
					<span class="block truncate text-xs opacity-80 {lesson.topicName ? '' : 'italic'}"
						>{lesson.topicName ?? 'Standalone Lesson'}</span
					>
				{:else}
					<span class="text-sm italic">Open Slot</span>
				{/if}
			</span>
			{#if cell.row.periodTo > cell.row.periodFrom}
				<span class="shrink-0 text-[11px] opacity-80" style:color={tone.fg}>{periods}</span>
			{/if}
		{:else}
			<span class="truncate text-xs font-semibold" style:color={tone.fg}>{cell.row.classLabel}</span
			>
			{#if lesson}
				<span
					class="mt-0.5 text-xs leading-tight font-medium {size === 'mini'
						? 'line-clamp-2 hidden sm:block'
						: 'line-clamp-2'}"
					style:color={tone.fg}>{lesson.title}</span
				>
				{#if size === 'full'}
					<span
						class="mt-auto line-clamp-1 text-[11px] opacity-80 {lesson.topicName ? '' : 'italic'}"
						style:color={tone.fg}>{lesson.topicName ?? 'Standalone Lesson'}</span
					>
				{/if}
			{:else}
				<span class="mt-0.5 text-xs italic" style:color={tone.fg}
					>{size === 'mini' ? 'Open' : 'Open Slot'}</span
				>
			{/if}
		{/if}
		{#if lesson && !lesson.topicName}
			<span
				class="pointer-events-none absolute inset-1 rounded-md border border-dashed"
				style:border-color={tone.ring}
			></span>
		{/if}
	</button>
{/if}
