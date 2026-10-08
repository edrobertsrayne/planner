<script lang="ts">
	// PROTOTYPE, throwaway (#372). Variant B: the Sequence laid out week by week, as the dates
	// fall. Drag a card by its handle onto another card to put it there; everything after it
	// reflows into the following Slots. Works with a mouse or a finger. Topics sit on the right
	// as sources with their overlap mark.
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import LockIcon from '@lucide/svelte/icons/lock';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button';
	import { addDays, formatDayMonth, formatShortWeekday, weekday } from '$lib/date';
	import { dateLabel, topicColour, type ProtoSequence } from './prototype-sequence-state.svelte';

	let { seq }: { seq: ProtoSequence } = $props();

	type Entry = (typeof seq.entries)[number];

	const mondayOf = (iso: string) => addDays(iso, 1 - weekday(iso));

	const weeks = $derived.by(() => {
		const rows: { key: string; label: string; entries: Entry[] }[] = [];
		for (const e of seq.entries) {
			const first = seq.firstAny(e.id);
			const key = first ? mondayOf(first.date) : 'past-end';
			let row = rows.find((r) => r.key === key);
			if (!row) {
				row = {
					key,
					label: first ? `w/c ${formatDayMonth(key)}` : 'Past the end of the year',
					entries: []
				};
				rows.push(row);
			}
			row.entries.push(e);
		}
		return rows;
	});

	let showTaughtWeeks = $state(false);
	const taughtWeekKeys = $derived(
		weeks.filter((w) => w.entries.every((e) => seq.isLocked(e.id))).map((w) => w.key)
	);

	// Pointer drag: mouse and touch alike.
	let dragId = $state<string | null>(null);
	let overId = $state<string | null>(null);
	let pointer = $state({ x: 0, y: 0 });

	function start(ev: PointerEvent, id: string) {
		ev.preventDefault();
		dragId = id;
		pointer = { x: ev.clientX, y: ev.clientY };
	}
	function move(ev: PointerEvent) {
		if (!dragId) return;
		pointer = { x: ev.clientX, y: ev.clientY };
		const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-drop]');
		overId = el?.getAttribute('data-drop') ?? null;
	}
	function end() {
		if (dragId && overId && overId !== dragId && overId !== `end:${dragId}`) {
			if (overId.startsWith('end:')) {
				seq.moveAfter([dragId], overId.slice(4));
			} else {
				const rest = seq.entries.filter((e) => e.id !== dragId);
				seq.moveTo(
					[dragId],
					rest.findIndex((e) => e.id === overId)
				);
			}
		}
		dragId = null;
		overId = null;
	}

	let addingAfter = $state<string | null>(null);
	let newTitle = $state('');
	const dragged = $derived(seq.entries.find((e) => e.id === dragId));
</script>

<svelte:window onpointermove={move} onpointerup={end} onpointercancel={end} />

{#snippet card(e: Entry)}
	{@const locked = seq.isLocked(e.id)}
	{@const changed = !locked && seq.changed(e.id)}
	<div
		data-drop={locked ? undefined : e.id}
		class="relative flex w-48 shrink-0 items-stretch rounded-lg border text-xs shadow-sm transition {overId ===
		e.id
			? 'translate-x-3 ring-2 ring-primary'
			: ''} {dragId === e.id ? 'opacity-30' : ''} {changed ? 'ring-2 ring-amber-400' : ''} {locked
			? 'opacity-60'
			: ''}"
		style:background-color={topicColour(e.topicId)}
		style:width={e.length > 1 ? '24rem' : undefined}
	>
		{#if locked}
			<span class="flex items-center px-1"><LockIcon class="size-3" /></span>
		{:else}
			<button
				class="flex cursor-grab touch-none items-center px-1 text-muted-foreground"
				onpointerdown={(ev) => start(ev, e.id)}
				aria-label="Drag {e.title}"><GripVerticalIcon class="size-4" /></button
			>
		{/if}
		<div class="min-w-0 flex-1 py-1.5 pr-1">
			<div class="text-muted-foreground tabular-nums">
				{dateLabel(seq.firstAny(e.id))}{#if e.length > 1}
					· {e.length} Periods{/if}
				{#if changed}<span class="ml-1 text-amber-700"
						>was {seq.was(e.id) ? dateLabel(seq.was(e.id)) : 'past the end'}</span
					>{/if}
			</div>
			<div class="truncate font-medium">{e.title}</div>
			<div class="truncate opacity-70">{e.topicName ?? 'Standalone Lesson'}</div>
			{#if e.note}<div class="mt-0.5 truncate text-amber-800">✎ {e.note}</div>{/if}
		</div>
		{#if !locked}
			<button
				class="absolute top-0.5 right-0.5 rounded p-0.5 text-muted-foreground hover:bg-black/10"
				onclick={() => seq.remove(e.id)}
				aria-label="Remove {e.title} from this Class"><XIcon class="size-3" /></button
			>
		{/if}
	</div>
{/snippet}

<section class="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_16rem]">
	<div class="min-w-0">
		<div class="flex items-center justify-between">
			<h2 class="text-sm font-semibold">
				Sequence by week <span class="font-normal text-muted-foreground"
					>{seq.entries.length} Lessons · drag a card onto another to put it there</span
				>
			</h2>
		</div>

		{#if seq.message}
			<p
				role="status"
				class="sticky top-0 z-10 mt-2 rounded-md px-3 py-2 text-xs shadow {seq.message.tone ===
				'refused'
					? 'bg-destructive/10 text-destructive'
					: 'bg-amber-50'}"
			>
				{seq.message.text}
			</p>
		{/if}

		<button
			class="mt-2 flex items-center gap-1 text-xs text-muted-foreground"
			onclick={() => (showTaughtWeeks = !showTaughtWeeks)}
		>
			<LockIcon class="size-3" />
			{taughtWeekKeys.length} taught weeks — {showTaughtWeeks ? 'hide' : 'show'}
		</button>

		<div class="mt-2 space-y-1.5">
			{#each weeks as w (w.key)}
				{#if showTaughtWeeks || !taughtWeekKeys.includes(w.key)}
					{@const last = w.entries.at(-1)}
					<div
						class="flex items-start gap-3 rounded-lg p-1.5 {w.key === 'past-end'
							? 'bg-destructive/5'
							: 'bg-muted/30'}"
					>
						<div
							class="w-24 shrink-0 pt-1.5 text-xs font-medium {w.key === 'past-end'
								? 'text-destructive'
								: 'text-muted-foreground'}"
						>
							{w.label}
						</div>
						<div class="flex min-w-0 flex-1 flex-wrap gap-1.5">
							{#each w.entries as e (e.id)}{@render card(e)}{/each}
							{#if last && !seq.isLocked(last.id)}
								<div
									data-drop="end:{last.id}"
									class="flex w-10 items-center justify-center rounded-lg border border-dashed text-muted-foreground {overId ===
									`end:${last.id}`
										? 'ring-2 ring-primary'
										: ''}"
								>
									<button
										class="p-2"
										onclick={() => (addingAfter = last.id)}
										aria-label="Add a Lesson after {last.title}"><PlusIcon class="size-4" /></button
									>
								</div>
							{/if}
						</div>
					</div>
					{#if addingAfter && w.entries.some((e) => e.id === addingAfter)}
						<form
							class="ml-28 flex gap-2"
							onsubmit={(ev) => {
								ev.preventDefault();
								seq.addLesson(newTitle, addingAfter);
								newTitle = '';
								addingAfter = null;
							}}
						>
							<input
								class="h-8 flex-1 rounded border bg-background px-2 text-sm"
								placeholder="New Standalone Lesson title"
								bind:value={newTitle}
							/>
							<Button size="sm" type="submit">Add</Button>
							<Button size="sm" variant="ghost" onclick={() => (addingAfter = null)}>Cancel</Button>
						</form>
					{/if}
				{/if}
			{/each}
		</div>
		{#if seq.layout.lastSlot}
			<p class="mt-2 text-xs text-muted-foreground">
				The last Slot this year is {formatShortWeekday(seq.layout.lastSlot)}.
			</p>
		{/if}
	</div>

	<aside class="h-fit space-y-2">
		<h3 class="text-xs font-semibold">Topics in {seq.topics.length ? 'this Course' : ''}</h3>
		{#each seq.topics as t (t.id)}
			{@const o = seq.overlap(t.id)}
			<div class="rounded-lg border p-2 text-xs" style:background-color={topicColour(t.id)}>
				<div class="font-medium">{t.name}</div>
				<div class="mt-0.5 opacity-70">
					{o.inSequence === o.total ? 'All' : `${o.inSequence} of ${o.total}`} in Sequence
				</div>
				{#if o.inSequence < o.total}
					<Button
						size="sm"
						variant="outline"
						class="mt-1 h-7 w-full bg-background text-xs"
						onclick={() => seq.assignTopic(t.id)}
						>Assign — add {o.total - o.inSequence} at the end</Button
					>
				{/if}
			</div>
		{/each}
	</aside>
</section>

{#if dragged}
	<div
		class="pointer-events-none fixed z-50 rounded-lg border bg-background px-2 py-1 text-xs font-medium shadow-lg"
		style:left="{pointer.x + 12}px"
		style:top="{pointer.y + 12}px"
	>
		{dragged.title}
	</div>
{/if}
