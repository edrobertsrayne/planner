<script lang="ts">
	// PROTOTYPE, throwaway (#372). Variant C: Planning's table, with a Class chosen. Tick one or
	// more Lessons, then "Move after…" puts them there as a block (good for interleaving a few
	// Lessons of one Topic into another). Changes are a draft: a "Was" column shows each date
	// that would change, and nothing is kept until Save order.
	import LockIcon from '@lucide/svelte/icons/lock';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button';
	import { formatShortWeekday } from '$lib/date';
	import { dateLabel, topicColour, type ProtoSequence } from './prototype-sequence-state.svelte';

	let { seq, classLabel }: { seq: ProtoSequence; classLabel: string } = $props();

	const draft = { draft: true };
	let selected = $state<string[]>([]);
	let target = $state('');
	let showTaught = $state(false);
	let adding = $state(false);
	let newTitle = $state('');
	let newAfter = $state('start');
	let assignOpen = $state(false);

	const untaught = $derived(seq.entries.slice(seq.firstMovable));
	const rows = $derived(showTaught ? seq.entries : untaught);
	const toggle = (id: string) =>
		(selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
</script>

<section class="mt-4 pb-24">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<div class="flex items-center gap-2">
			<h2 class="text-lg font-semibold">Planning</h2>
			<span class="rounded-2xl bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
				>{classLabel}</span
			>
			<span class="text-xs text-muted-foreground">Class order · {seq.entries.length} Lessons</span>
		</div>
		<div class="relative flex gap-2">
			<Button size="sm" variant="outline" onclick={() => (adding = !adding)}>Add Lesson</Button>
			<Button size="sm" variant="outline" onclick={() => (assignOpen = !assignOpen)}
				>Assign Topic ▾</Button
			>
			{#if assignOpen}
				<div
					class="absolute top-full right-0 z-20 mt-1 w-72 rounded-lg border bg-popover p-1 text-sm shadow-lg"
				>
					{#each seq.topics as t (t.id)}
						{@const o = seq.overlap(t.id)}
						<button
							class="flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50"
							disabled={o.inSequence === o.total}
							onclick={() => {
								seq.assignTopic(t.id, draft);
								assignOpen = false;
							}}
						>
							<span>{t.name}</span>
							<span class="text-xs text-muted-foreground"
								>{o.inSequence === o.total ? 'all' : `${o.inSequence} of ${o.total}`} in Sequence</span
							>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	{#if adding}
		<form
			class="mt-2 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2 text-sm"
			onsubmit={(ev) => {
				ev.preventDefault();
				seq.addLesson(newTitle, newAfter === 'start' ? null : newAfter, draft);
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
				<option value="start">First untaught</option>
				{#each untaught as o (o.id)}
					<option value={o.id}>After {o.title}</option>
				{/each}
			</select>
			<Button size="sm" type="submit">Add</Button>
		</form>
	{/if}

	{#if seq.message?.tone === 'refused'}
		<p role="alert" class="mt-2 text-xs text-destructive">{seq.message.text}</p>
	{/if}

	<button
		class="mt-3 text-xs text-muted-foreground underline"
		onclick={() => (showTaught = !showTaught)}
		>{showTaught ? 'Hide' : 'Show'} the {seq.firstMovable} taught Lessons</button
	>

	<table class="mt-2 w-full table-fixed border-separate border-spacing-0 text-sm">
		<thead class="sticky top-0 z-10 bg-background text-left text-xs text-muted-foreground">
			<tr>
				<th class="w-8 border-b py-2"></th>
				<th class="w-32 border-b py-2 pr-3 font-medium">Date</th>
				<th class="w-32 border-b py-2 pr-3 font-medium">Was</th>
				<th class="border-b py-2 pr-3 font-medium">Lesson</th>
				<th class="hidden w-44 border-b py-2 pr-3 font-medium lg:table-cell">Topic</th>
				<th class="w-20 border-b py-2 font-medium">Status</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as e, i (e.id)}
				{@const locked = seq.isLocked(e.id)}
				{@const changed = !locked && seq.changed(e.id)}
				{@const firstPast = seq.pastEnd(e.id) && !seq.pastEnd(rows[i - 1]?.id ?? '')}
				{#if firstPast}
					<tr>
						<td
							colspan="6"
							class="border-b bg-destructive/5 px-2 py-1.5 text-xs font-medium text-destructive"
							>Past the end of the year{#if seq.layout.lastSlot}
								— the last Slot is {formatShortWeekday(seq.layout.lastSlot)}{/if}</td
						>
					</tr>
				{/if}
				<tr
					class="align-top {selected.includes(e.id) ? 'bg-primary/5' : ''} {locked
						? 'text-muted-foreground'
						: ''}"
				>
					<td class="border-b py-2">
						{#if locked}
							<LockIcon class="size-3.5" aria-label="Taught, fixed" />
						{:else}
							<input
								type="checkbox"
								class="size-4"
								checked={selected.includes(e.id)}
								onchange={() => toggle(e.id)}
								aria-label="Select {e.title}"
							/>
						{/if}
					</td>
					<td
						class="border-b py-2 pr-3 text-xs whitespace-nowrap tabular-nums {changed
							? 'font-semibold text-amber-700'
							: ''}"
					>
						{seq.pastEnd(e.id) ? '—' : dateLabel(seq.firstAny(e.id))}
					</td>
					<td
						class="border-b py-2 pr-3 text-xs whitespace-nowrap text-muted-foreground tabular-nums"
					>
						{#if changed}{seq.was(e.id) ? dateLabel(seq.was(e.id)) : 'past the end'}{/if}
					</td>
					<td class="border-b py-2 pr-3">
						<span class="block truncate font-medium">{e.title}</span>
						{#if e.note}<span class="block truncate text-xs text-amber-700">Note: {e.note}</span
							>{/if}
					</td>
					<td class="hidden border-b py-2 pr-3 lg:table-cell">
						<span
							class="rounded px-1.5 py-0.5 text-xs"
							style:background-color={topicColour(e.topicId)}
							>{e.topicName ?? 'Standalone Lesson'}</span
						>
					</td>
					<td class="border-b py-2">
						<Badge variant={e.status === 'planned' ? 'secondary' : 'outline'}
							>{e.status === 'planned' ? 'Planned' : 'Draft'}</Badge
						>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

{#if selected.length || seq.dirty}
	<div
		class="fixed inset-x-0 bottom-14 z-40 mx-auto flex w-fit max-w-[95vw] flex-wrap items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm shadow-xl"
	>
		{#if selected.length}
			<span class="font-medium">{selected.length} selected</span>
			<select class="h-8 max-w-56 rounded border bg-background px-1 text-xs" bind:value={target}>
				<option value="">Move after…</option>
				<option value="start">First untaught</option>
				{#each untaught.filter((o) => !selected.includes(o.id)) as o (o.id)}
					<option value={o.id}>{o.title}</option>
				{/each}
			</select>
			<Button
				size="sm"
				disabled={!target}
				onclick={() => {
					const ordered = seq.entries.filter((e) => selected.includes(e.id)).map((e) => e.id);
					seq.moveAfter(ordered, target === 'start' ? null : target, draft);
					selected = [];
					target = '';
				}}>Move</Button
			>
			<Button
				size="sm"
				variant="outline"
				onclick={() => {
					for (const id of selected) seq.remove(id, draft);
					selected = [];
				}}>Remove from {classLabel}</Button
			>
			<span class="mx-1 h-5 w-px bg-border"></span>
		{/if}
		{#if seq.dirty}
			<span class="text-xs text-muted-foreground"
				>Unsaved order · {seq.changedCount} dates change{#if seq.pastEndCount}
					· {seq.pastEndCount} past the end{/if}</span
			>
			<Button size="sm" variant="ghost" onclick={() => seq.discard()}>Discard</Button>
			<Button size="sm" onclick={() => seq.save()}>Save order</Button>
		{/if}
	</div>
{/if}
