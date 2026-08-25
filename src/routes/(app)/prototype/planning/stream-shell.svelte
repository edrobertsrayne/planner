<script lang="ts">
	import type { Snippet } from 'svelte';
	import { counts, ordered, statusTone, type MockLesson, type Status } from './data';

	// Settled on #103 and unchanged by #106: single-select filter chips with live counts,
	// a Show 10/25/50/All control, a "Showing X of Y" line, and a dashed empty state.
	// Only the Ready chip is gone. The row is the variable — each variant passes its own.

	let {
		lessons,
		note,
		row
	}: {
		lessons: MockLesson[];
		note: string;
		row: Snippet<[MockLesson]>;
	} = $props();

	type Filter = Status | 'all';
	const FILTERS: { key: Filter; name: string }[] = [
		{ key: 'all', name: 'All' },
		{ key: 'draft', name: 'Draft' },
		{ key: 'planned', name: 'Planned' }
	];
	const SIZES: { value: number | 'all'; label: string }[] = [
		{ value: 10, label: 'Show 10' },
		{ value: 25, label: 'Show 25' },
		{ value: 50, label: 'Show 50' },
		{ value: 'all', label: 'Show all' }
	];

	let filter = $state<Filter>('all');
	let size = $state<number | 'all'>(10);

	const tally = $derived(counts(lessons));
	const filtered = $derived(
		ordered(lessons).filter((l) => filter === 'all' || l.status === filter)
	);
	const visible = $derived(size === 'all' ? filtered : filtered.slice(0, size));
</script>

<p class="pb-3 text-xs text-muted-foreground">{note}</p>

<div class="flex flex-wrap items-center justify-between gap-2 pb-3">
	<div class="flex items-center gap-1" role="group" aria-label="Filter by planning status">
		{#each FILTERS as f (f.key)}
			{@const on = filter === f.key}
			{@const tone = f.key === 'all' ? null : statusTone(f.key)}
			<button
				type="button"
				aria-pressed={on}
				class="rounded-full border px-3 py-1 text-xs transition-colors {on
					? 'border-transparent'
					: 'hover:bg-muted'} {on && !tone ? 'bg-primary text-primary-foreground' : ''}"
				style:background-color={on && tone ? tone.bg : undefined}
				style:color={on && tone ? tone.fg : undefined}
				onclick={() => (filter = f.key)}
			>
				{f.name} <span class="tabular-nums opacity-60">{tally[f.key]}</span>
			</button>
		{/each}
	</div>

	<div class="flex items-center gap-1 rounded-md border p-0.5 text-xs" role="group">
		{#each SIZES as s (s.label)}
			<button
				type="button"
				aria-pressed={size === s.value}
				class="rounded px-2 py-1 transition-colors {size === s.value
					? 'bg-primary text-primary-foreground'
					: 'hover:bg-muted'}"
				onclick={() => (size = s.value)}
			>
				{s.label}
			</button>
		{/each}
	</div>
</div>

{#if visible.length}
	<ul class="flex flex-col gap-2">
		{#each visible as lesson (lesson.id)}
			{@render row(lesson)}
		{/each}
	</ul>
{:else}
	<div class="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
		Nothing {filter === 'all' ? 'to show' : `${filter} right now`}
	</div>
{/if}

{#if size !== 'all' && filtered.length > visible.length}
	<p class="pt-2 text-center text-xs text-muted-foreground">
		Showing {visible.length} of {filtered.length}
	</p>
{/if}
