<script lang="ts">
	import { resolve } from '$app/paths';
	import CheckIcon from '@lucide/svelte/icons/check';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import LockIcon from '@lucide/svelte/icons/lock';
	import XIcon from '@lucide/svelte/icons/x';
	import Markdown from '$lib/components/markdown.svelte';
	import { formatDateShort, formatDayMonth } from '$lib/date';
	import type { SlotFill } from '$lib/sequence-layout';
	import { topicColour } from '$lib/topic-colour';
	import type { SequenceEntry, WeekRow } from '$lib/server/planner';

	// The By week layout: each week row holds the Class's Slots in fixed places, and the Lessons go
	// through them. A drop takes the target's Slot, so `fills` (what each Slot shows) is the live
	// preview while a drag is on. The drag itself belongs to the tab; this file only draws.
	let {
		classId,
		weeks,
		freeAfter,
		entries,
		pastEnd,
		fills,
		changing,
		dragIds,
		ringed,
		was,
		selectMode,
		selected,
		onPick,
		onGrip,
		onRemove
	}: {
		classId: string;
		weeks: WeekRow[];
		freeAfter: number;
		entries: SequenceEntry[];
		// The Lessons with no Slot left, in Sequence order.
		pastEnd: string[];
		// What each movable Slot shows now: the preview during a drag, else the engine's layout.
		fills: Map<string, SlotFill>;
		// Lessons that will change Slot if the drop happens now.
		changing: Set<string>;
		dragIds: string[];
		// The Lessons just moved.
		ringed: string[];
		// Each Lesson whose first Slot changed in the last write, with its old date.
		was: Map<string, string | null>;
		// Select mode: a tap picks a Lesson instead of opening it, and the × buttons go.
		selectMode: boolean;
		selected: string[];
		onPick: (entry: SequenceEntry) => void;
		onGrip: (event: PointerEvent, lessonId: string) => void;
		onRemove: (entry: SequenceEntry) => void;
	} = $props();

	const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
	const byId = $derived(new Map(entries.map((entry) => [entry.lessonId, entry])));
	const taught = $derived(entries.filter((entry) => entry.fixed));
	const dragging = $derived(dragIds.length > 0);
	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
	// In select mode a tap on a Lesson picks it, and never follows the link.
	const pick = (event: MouseEvent, entry: SequenceEntry) => {
		if (!selectMode) return;
		event.preventDefault();
		onPick(entry);
	};
	const wasText = (lessonId: string) =>
		was.get(lessonId) ? `was ${formatDateShort(was.get(lessonId)!)}` : 'was past the end';
</script>

{#snippet lessonCard(entry: SequenceEntry, part: number, of: number, base: string | null)}
	{@const isSelected = selected.includes(entry.lessonId)}
	<div
		class="relative flex h-full items-stretch rounded-md border {dragIds.includes(entry.lessonId)
			? 'opacity-40'
			: ''} {isSelected ? 'border-primary ring-2 ring-primary' : ''} {changing.has(entry.lessonId)
			? 'border-dashed border-primary outline-dashed'
			: ''} {!dragging && ringed.includes(entry.lessonId) ? 'ring-2 ring-amber-500' : ''}"
		style:background-color={topicColour(entry.topicId, isSelected ? 0.45 : 0.12)}
		data-drop={base ?? undefined}
		data-lesson-card
		data-selected={isSelected ? '' : undefined}
		data-changing={changing.has(entry.lessonId) ? '' : undefined}
	>
		<button
			type="button"
			class="flex w-6 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground"
			aria-label="Drag {entry.title}"
			onpointerdown={(event) => onGrip(event, entry.lessonId)}
		>
			<GripVerticalIcon class="size-4" />
		</button>
		<a
			href={resolve(`/lessons/${entry.lessonId}?class=${classId}`)}
			class="flex min-w-0 flex-1 flex-col gap-0.5 py-1.5 pr-1 hover:bg-muted/40"
			onclick={(event) => pick(event, entry)}
		>
			<span class="flex items-start gap-1">
				<span class="text-sm leading-tight font-medium" data-title>{entry.title}</span>
				{#if isSelected}
					<CheckIcon class="mt-0.5 size-3.5 shrink-0 text-primary" aria-label="Selected" />
				{/if}
			</span>
			<span class="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
				{#if entry.topicName}
					<span class="flex items-center gap-1">
						<span
							class="size-2 rounded-full"
							style:background-color={topicColour(entry.topicId, 0.8)}
							aria-hidden="true"
						></span>
						{entry.topicName}
					</span>
				{/if}
				{#if of > 1}<span>part {part} of {of}</span>{/if}
				{#if entry.ready}
					<span class="flex items-center gap-0.5" data-ready>
						<CheckIcon class="size-3" aria-hidden="true" />Ready
					</span>
				{/if}
				{#if !dragging && was.has(entry.lessonId)}
					<span class="text-amber-700 dark:text-amber-400" data-was>{wasText(entry.lessonId)}</span>
				{/if}
			</span>
		</a>
		{#if !selectMode}
			<button
				type="button"
				class="flex items-start px-1.5 pt-1.5 text-muted-foreground hover:text-foreground"
				aria-label={`Remove ${entry.title}`}
				onclick={() => onRemove(entry)}
			>
				<XIcon class="size-4" aria-hidden="true" />
			</button>
		{/if}
	</div>
{/snippet}

<div class="mt-3" data-weeks>
	{#if taught.length}
		<details class="mb-2 rounded-lg border px-3 py-2 text-xs" data-taught>
			<summary class="cursor-pointer text-muted-foreground">
				{plural(taught.length, 'Lesson')} taught, fixed — show
			</summary>
			<ul class="mt-2 space-y-1">
				{#each taught as entry (entry.lessonId)}
					<li class="flex items-center gap-2" data-taught-lesson>
						<LockIcon class="size-3 shrink-0" aria-label="Fixed: already taught" />
						<a
							class="font-medium hover:underline"
							href={resolve(`/lessons/${entry.lessonId}?class=${classId}`)}
							onclick={(event) => pick(event, entry)}>{entry.title}</a
						>
						{#if entry.topicName}<span class="text-muted-foreground">{entry.topicName}</span>{/if}
						{#if entry.firstDate}
							<span class="ml-auto text-muted-foreground tabular-nums">
								{formatDateShort(entry.firstDate)}
							</span>
						{/if}
					</li>
				{/each}
			</ul>
		</details>
	{/if}

	<ol class="rounded-xl border" data-sequence-weeks>
		{#each weeks as row, i (i)}
			{#if row.kind === 'holiday'}
				<li
					class="border-t bg-muted/40 px-3 py-0.5 text-center text-[11px] text-muted-foreground first:border-t-0"
					data-holiday
				>
					School Holiday · {formatDayMonth(row.from)} – {formatDayMonth(row.to)}
				</li>
			{:else}
				<li class="flex gap-3 border-t px-3 py-2 first:border-t-0" data-week>
					<div class="w-20 shrink-0 text-xs">
						<p class="font-medium">Week {row.letter}</p>
						<p class="text-muted-foreground">{formatDayMonth(row.weekCommencing)}</p>
					</div>
					<div class="flex min-w-0 flex-1 flex-wrap gap-2">
						{#each row.cells as cell (cell.key)}
							{@const fill =
								cell.kind === 'lesson' || cell.kind === 'free' ? fills.get(cell.key) : null}
							{@const entry = fill
								? byId.get(fill.lessonId)
								: cell.lessonId
									? byId.get(cell.lessonId)
									: undefined}
							<div class="min-w-44 flex-1 basis-44" data-cell data-cell-kind={cell.kind}>
								<p class="mb-0.5 text-[11px] text-muted-foreground tabular-nums">
									{DAYS[cell.day - 1]} · P{cell.period} · {formatDateShort(cell.date)}
								</p>
								{#if (cell.kind === 'lesson' || cell.kind === 'free') && fill && entry}
									{@render lessonCard(
										entry,
										fill.part,
										fill.of,
										cell.kind === 'lesson' ? cell.lessonId : null
									)}
								{:else if cell.kind === 'free'}
									<div
										class="flex h-full min-h-10 items-center rounded-md border bg-muted/30 px-2 text-xs text-muted-foreground"
										data-free
									>
										Free
									</div>
								{:else if cell.kind === 'taught' && entry}
									<div
										class="flex min-h-10 items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1.5 text-sm"
										data-fixed-card
										role="presentation"
										onclick={() => selectMode && onPick(entry)}
									>
										<LockIcon class="size-3 shrink-0" aria-label="Fixed: already taught" />
										<span class="font-medium" data-title>{entry.title}</span>
									</div>
								{:else if cell.kind === 'placed'}
									<div
										class="flex min-h-10 items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1.5 text-sm"
										data-placed-card
									>
										<LockIcon class="size-3 shrink-0" aria-hidden="true" />
										<span class="font-medium">{cell.title ?? 'Placement'}</span>
										<span class="ml-auto text-xs text-muted-foreground">Placed</span>
									</div>
								{:else}
									<div
										class="flex min-h-10 items-center rounded-md px-2 text-xs text-muted-foreground"
									>
										{cell.kind === 'blocked' ? 'Blocked' : '—'}
									</div>
								{/if}
							</div>
						{:else}
							<p class="text-xs text-muted-foreground">No Slots this week.</p>
						{/each}
					</div>
				</li>
			{/if}
		{:else}
			<li class="px-3 py-4 text-sm text-muted-foreground">
				This Class has no Slots left this year.
			</li>
		{/each}
	</ol>

	{#if weeks.length}
		<p class="mt-2 text-xs text-muted-foreground" data-free-after>
			{plural(freeAfter, 'other free Slot')} to the end of the year.
		</p>
	{/if}

	{#if pastEnd.length}
		<section class="mt-3 rounded-xl border border-destructive/40 p-3" data-past-end>
			<h3 class="text-xs font-semibold text-destructive">Past the end of the year</h3>
			<ul class="mt-2 grid gap-2 sm:grid-cols-2">
				{#each pastEnd as lessonId (lessonId)}
					{@const entry = byId.get(lessonId)}
					{#if entry}
						<li class="flex flex-col gap-1" data-past-end-lesson>
							{@render lessonCard(entry, 1, 1, lessonId)}
							{#if entry.note}
								<Markdown source={entry.note} class="line-clamp-2 text-xs text-muted-foreground" />
							{/if}
						</li>
					{/if}
				{/each}
			</ul>
		</section>
	{/if}
</div>
