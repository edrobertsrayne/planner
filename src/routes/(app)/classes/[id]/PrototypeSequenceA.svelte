<script lang="ts">
	// PROTOTYPE, throwaway (#372). Variant A: a Sequence tab on the Class page. One row per
	// Lesson; up/down buttons and "Move after…" per row. Every move applies at once and the rows
	// whose date changed show the old date struck through.
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import LockIcon from '@lucide/svelte/icons/lock';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button';
	import { formatShortWeekday } from '$lib/date';
	import { dateLabel, topicColour, type ProtoSequence } from './prototype-sequence-state.svelte';

	let { seq }: { seq: ProtoSequence } = $props();

	let showTaught = $state(false);
	let movingId = $state<string | null>(null);
	let adding = $state(false);
	let newTitle = $state('');
	let newAfter = $state<string>('start');
	let topicPick = $state('');

	const taught = $derived(seq.entries.slice(0, seq.firstMovable));
	const untaught = $derived(seq.entries.slice(seq.firstMovable));
	const inYear = $derived(untaught.filter((e) => !seq.pastEnd(e.id)));
	const pastEnd = $derived(untaught.filter((e) => seq.pastEnd(e.id)));
</script>

{#snippet row(e: (typeof seq.entries)[number], i: number, locked: boolean)}
	{@const now = seq.firstAny(e.id)}
	{@const was = seq.was(e.id)}
	<li
		class="flex items-center gap-3 border-b px-2 py-1.5 text-sm {locked
			? 'text-muted-foreground'
			: ''} {seq.lastMoved === e.id ? 'bg-amber-50' : ''}"
	>
		<span class="w-6 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</span>
		<span class="w-36 shrink-0 text-xs tabular-nums">
			{#if seq.pastEnd(e.id)}
				<span class="text-destructive">Past the end of the year</span>
			{:else}
				{dateLabel(now)}
				{#if e.length > 1}<span class="text-muted-foreground">· {e.length} Periods</span>{/if}
			{/if}
			{#if !locked && seq.changed(e.id)}
				<span class="block text-muted-foreground line-through"
					>{was ? dateLabel(was) : 'past the end'}</span
				>
			{/if}
		</span>
		<span class="min-w-0 flex-1">
			<span class="block truncate font-medium">{e.title}</span>
			{#if e.note}
				<span class="block truncate text-xs text-amber-700">Note: {e.note}</span>
			{/if}
		</span>
		<span
			class="hidden shrink-0 rounded px-1.5 py-0.5 text-xs sm:inline"
			style:background-color={topicColour(e.topicId)}>{e.topicName ?? 'Standalone'}</span
		>
		{#if locked}
			<LockIcon class="size-3.5 shrink-0" aria-label="Taught, fixed" />
		{:else if movingId === e.id}
			<select
				class="h-8 rounded border bg-background px-1 text-xs"
				onchange={(ev) => {
					const v = ev.currentTarget.value;
					seq.moveAfter([e.id], v === 'start' ? null : v);
					movingId = null;
				}}
			>
				<option value="">Move after…</option>
				<option value="start">— Start of the untaught part —</option>
				{#each untaught.filter((o) => o.id !== e.id) as o, j (o.id)}
					<option value={o.id}>{seq.firstMovable + j + 1}. {o.title}</option>
				{/each}
			</select>
			<Button variant="ghost" size="sm" onclick={() => (movingId = null)}>Cancel</Button>
		{:else}
			<div class="flex shrink-0 items-center">
				<Button
					variant="ghost"
					size="icon-sm"
					disabled={i === seq.firstMovable}
					onclick={() => seq.moveBy(e.id, -1)}
					aria-label="Move {e.title} up"><ChevronUpIcon class="size-3.5" /></Button
				>
				<Button
					variant="ghost"
					size="icon-sm"
					disabled={i === seq.entries.length - 1}
					onclick={() => seq.moveBy(e.id, 1)}
					aria-label="Move {e.title} down"><ChevronDownIcon class="size-3.5" /></Button
				>
				<Button variant="ghost" size="sm" class="text-xs" onclick={() => (movingId = e.id)}
					>Move after…</Button
				>
				<Button
					variant="ghost"
					size="icon-sm"
					onclick={() => seq.remove(e.id)}
					aria-label="Remove {e.title} from this Class"><XIcon class="size-3.5" /></Button
				>
			</div>
		{/if}
	</li>
{/snippet}

<section class="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
	<div class="min-w-0">
		<div class="flex items-center justify-between">
			<h2 class="text-sm font-semibold">
				Sequence <span class="font-normal text-muted-foreground">{seq.entries.length} Lessons</span>
			</h2>
			<Button size="sm" variant="outline" onclick={() => (adding = !adding)}>Add Lesson</Button>
		</div>

		{#if adding}
			<form
				class="mt-2 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2 text-sm"
				onsubmit={(ev) => {
					ev.preventDefault();
					seq.addLesson(newTitle, newAfter === 'start' ? null : newAfter);
					newTitle = '';
					adding = false;
				}}
			>
				<input
					class="h-8 flex-1 rounded border bg-background px-2"
					placeholder="New Standalone Lesson title"
					bind:value={newTitle}
				/>
				<select class="h-8 rounded border bg-background px-1 text-xs" bind:value={newAfter}>
					<option value="start">At the start of the untaught part</option>
					{#each untaught as o, j (o.id)}
						<option value={o.id}>After {seq.firstMovable + j + 1}. {o.title}</option>
					{/each}
				</select>
				<Button size="sm" type="submit">Add</Button>
			</form>
		{/if}

		{#if seq.message}
			<p
				role="status"
				class="mt-2 rounded-md px-3 py-2 text-xs {seq.message.tone === 'refused'
					? 'bg-destructive/10 text-destructive'
					: 'bg-muted'}"
			>
				{seq.message.text}
			</p>
		{/if}

		<ul class="mt-2 rounded-lg border">
			<li class="border-b bg-muted/40">
				<button
					class="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground"
					onclick={() => (showTaught = !showTaught)}
				>
					<LockIcon class="size-3.5" />
					{taught.length} Lessons taught — fixed. {showTaught ? 'Hide' : 'Show'}
				</button>
			</li>
			{#if showTaught}
				{#each taught as e, i (e.id)}{@render row(e, i, true)}{/each}
			{/if}
			{#each inYear as e, j (e.id)}{@render row(e, seq.firstMovable + j, false)}{/each}
			{#if pastEnd.length}
				<li class="border-b bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
					Past the end of the year{#if seq.layout.lastSlot}
						— the last Slot is {formatShortWeekday(seq.layout.lastSlot)}{/if}
				</li>
				{#each pastEnd as e, j (e.id)}{@render row(
						e,
						seq.firstMovable + inYear.length + j,
						false
					)}{/each}
			{/if}
		</ul>
	</div>

	<aside class="h-fit rounded-lg border p-3 text-sm">
		<h3 class="text-xs font-semibold">Assign Topic</h3>
		<p class="mt-1 text-xs text-muted-foreground">
			Adds the Topic's Lessons at the end. Lessons already in this Sequence are skipped.
		</p>
		<select
			class="mt-2 h-8 w-full rounded border bg-background px-1 text-xs"
			bind:value={topicPick}
		>
			<option value="">Pick a Topic…</option>
			{#each seq.topics as t (t.id)}
				{@const o = seq.overlap(t.id)}
				<option value={t.id}
					>{t.name} — {o.inSequence === o.total
						? 'all in Sequence'
						: `${o.inSequence} of ${o.total} in Sequence`}</option
				>
			{/each}
		</select>
		<Button
			size="sm"
			class="mt-2 w-full"
			disabled={!topicPick}
			onclick={() => {
				seq.assignTopic(topicPick);
				topicPick = '';
			}}>Assign</Button
		>
	</aside>
</section>
