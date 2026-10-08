<script lang="ts">
	// PROTOTYPE, throwaway (#372). One Class's Sequence, with the layout and the move control as
	// independent switches. Whether a change is kept at once or waits for Save is `seq.draft`.
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import LockIcon from '@lucide/svelte/icons/lock';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button';
	import { addDays, formatDayMonth, formatShortWeekday, weekday } from '$lib/date';
	import {
		dateLabel,
		topicColour,
		type ProtoEntry,
		type ProtoSequence
	} from './prototype-sequence-state.svelte';

	let {
		seq,
		layout,
		control
	}: { seq: ProtoSequence; layout: 'list' | 'weeks'; control: 'buttons' | 'drag' | 'tick' } =
		$props();

	let showTaught = $state(false);
	let movingId = $state<string | null>(null);
	let selected = $state<string[]>([]);
	let tickTarget = $state('');
	let adding = $state(false);
	let newTitle = $state('');
	let newAfter = $state('start');
	let assignOpen = $state(false);

	const untaught = $derived(seq.entries.slice(seq.firstMovable));
	const visible = $derived(showTaught ? seq.entries : untaught);
	const indexOf = (id: string) => seq.entries.findIndex((e) => e.id === id) + 1;

	// Rows grouped for the "weeks" layout: by the week of each Lesson's first part.
	const weeks = $derived.by(() => {
		const rows: { key: string; label: string; entries: ProtoEntry[] }[] = [];
		for (const e of visible) {
			const first = seq.first(e.id);
			const key =
				seq.pastEnd(e.id) || !first ? 'past-end' : addDays(first.date, 1 - weekday(first.date));
			let row = rows.find((r) => r.key === key);
			if (!row) {
				row = {
					key,
					label: key === 'past-end' ? 'Past the end of the year' : `w/c ${formatDayMonth(key)}`,
					entries: []
				};
				rows.push(row);
			}
			row.entries.push(e);
		}
		return rows;
	});

	// Pointer drag, for a mouse or a finger. A drop on an entry puts the dragged one in front of it.
	let dragId = $state<string | null>(null);
	let overId = $state<string | null>(null);
	let pointer = $state({ x: 0, y: 0 });
	function dragStart(ev: PointerEvent, id: string) {
		ev.preventDefault();
		dragId = id;
		pointer = { x: ev.clientX, y: ev.clientY };
	}
	function dragMove(ev: PointerEvent) {
		if (!dragId) return;
		pointer = { x: ev.clientX, y: ev.clientY };
		const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-drop]');
		overId = el?.getAttribute('data-drop') ?? null;
	}
	function dragEnd() {
		if (dragId && overId && overId !== dragId) {
			if (overId === 'end') seq.moveTo([dragId], seq.entries.length - 1);
			else seq.moveBefore(dragId, overId);
		}
		dragId = null;
		overId = null;
	}
	const dragged = $derived(seq.entries.find((e) => e.id === dragId));

	const toggle = (id: string) =>
		(selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
</script>

<svelte:window onpointermove={dragMove} onpointerup={dragEnd} onpointercancel={dragEnd} />

{#snippet dates(e: ProtoEntry)}
	{@const changed = seq.changed(e.id)}
	{#if seq.pastEnd(e.id)}
		<span class="text-destructive">No Slot left</span>
	{:else}
		<span class={changed ? 'font-semibold text-amber-600 dark:text-amber-400' : ''}
			>{dateLabel(seq.first(e.id))}</span
		>
	{/if}
	{#if e.length > 1}<span class="text-muted-foreground"> · {e.length} Periods</span>{/if}
	{#if changed}
		<span class="block text-muted-foreground line-through"
			>{seq.was(e.id) ? dateLabel(seq.was(e.id)) : 'no Slot'}</span
		>
	{/if}
{/snippet}

{#snippet topicChip(e: ProtoEntry)}
	<span
		class="inline-block max-w-36 truncate rounded px-1.5 py-0.5 align-middle text-xs"
		style:background-color={topicColour(e.topicId)}
		title={e.topicName ?? 'Standalone Lesson'}>{e.topicName ?? 'Standalone'}</span
	>
{/snippet}

{#snippet controls(e: ProtoEntry)}
	{#if seq.isLocked(e.id)}
		<LockIcon class="size-3.5 shrink-0 text-muted-foreground" aria-label="Taught, fixed" />
	{:else if control === 'buttons'}
		{#if movingId === e.id}
			<select
				class="h-8 max-w-48 rounded border bg-background px-1 text-xs"
				onchange={(ev) => {
					const v = ev.currentTarget.value;
					if (v) seq.moveAfter([e.id], v === 'start' ? null : v);
					movingId = null;
				}}
			>
				<option value="">Move after…</option>
				<option value="start">— First untaught —</option>
				{#each untaught.filter((o) => o.id !== e.id) as o (o.id)}
					<option value={o.id}>{indexOf(o.id)}. {o.title}</option>
				{/each}
			</select>
		{:else}
			<div class="flex shrink-0 items-center">
				<Button
					variant="ghost"
					size="icon-sm"
					disabled={indexOf(e.id) - 1 === seq.firstMovable}
					onclick={() => seq.moveBy(e.id, -1)}
					aria-label="Move {e.title} up"><ChevronUpIcon class="size-4" /></Button
				>
				<Button
					variant="ghost"
					size="icon-sm"
					disabled={indexOf(e.id) === seq.entries.length}
					onclick={() => seq.moveBy(e.id, 1)}
					aria-label="Move {e.title} down"><ChevronDownIcon class="size-4" /></Button
				>
				<Button variant="ghost" size="sm" class="px-2 text-xs" onclick={() => (movingId = e.id)}
					>Move after…</Button
				>
				<Button
					variant="ghost"
					size="icon-sm"
					onclick={() => seq.remove([e.id])}
					aria-label="Remove {e.title} from this Class"><XIcon class="size-3.5" /></Button
				>
			</div>
		{/if}
	{:else if control === 'drag'}
		<div class="flex shrink-0 items-center">
			<Button
				variant="ghost"
				size="icon-sm"
				onclick={() => seq.remove([e.id])}
				aria-label="Remove {e.title} from this Class"><XIcon class="size-3.5" /></Button
			>
		</div>
	{/if}
{/snippet}

{#snippet lead(e: ProtoEntry)}
	{#if seq.isLocked(e.id)}
		<span class="w-5 shrink-0"></span>
	{:else if control === 'drag'}
		<button
			class="flex w-5 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground"
			onpointerdown={(ev) => dragStart(ev, e.id)}
			aria-label="Drag {e.title}"><GripVerticalIcon class="size-4" /></button
		>
	{:else if control === 'tick'}
		<input
			type="checkbox"
			class="size-4 shrink-0"
			checked={selected.includes(e.id)}
			onchange={() => toggle(e.id)}
			aria-label="Select {e.title}"
		/>
	{:else}
		<span class="w-5 shrink-0"></span>
	{/if}
{/snippet}

{#snippet row(e: ProtoEntry)}
	{@const locked = seq.isLocked(e.id)}
	<li
		data-drop={locked ? undefined : e.id}
		class="flex items-center gap-3 border-b px-2 py-2 text-sm transition-colors
			{locked ? 'text-muted-foreground' : ''}
			{seq.lastMoved.includes(e.id) ? 'bg-amber-500/10' : ''}
			{selected.includes(e.id) ? 'bg-primary/5' : ''}
			{dragId === e.id ? 'opacity-40' : ''}
			{overId === e.id && dragId !== e.id ? 'border-t-2 border-t-primary' : ''}"
	>
		{@render lead(e)}
		<span class="w-6 shrink-0 text-right text-xs text-muted-foreground tabular-nums"
			>{indexOf(e.id)}</span
		>
		<span class="w-40 shrink-0 text-xs tabular-nums">{@render dates(e)}</span>
		<span class="min-w-0 flex-1">
			<span class="line-clamp-2 font-medium">{e.title}</span>
			{#if e.note}<span class="block truncate text-xs text-amber-700 dark:text-amber-400"
					>✎ {e.note}</span
				>{/if}
		</span>
		<span class="hidden shrink-0 sm:block">{@render topicChip(e)}</span>
		{@render controls(e)}
	</li>
{/snippet}

{#snippet card(e: ProtoEntry)}
	{@const locked = seq.isLocked(e.id)}
	<div
		data-drop={locked ? undefined : e.id}
		class="flex w-60 shrink-0 gap-2 rounded-lg border p-2 text-xs transition
			{locked ? 'opacity-60' : ''}
			{seq.lastMoved.includes(e.id) ? 'ring-2 ring-amber-500' : ''}
			{selected.includes(e.id) ? 'ring-2 ring-primary' : ''}
			{dragId === e.id ? 'opacity-40' : ''}
			{overId === e.id && dragId !== e.id ? 'border-l-4 border-l-primary' : ''}"
		style:background-color={topicColour(e.topicId, 0.14)}
	>
		<div class="pt-0.5">{@render lead(e)}</div>
		<div class="min-w-0 flex-1">
			<div class="tabular-nums">{@render dates(e)}</div>
			<div class="mt-0.5 line-clamp-2 text-sm font-medium">{e.title}</div>
			<div class="mt-1">{@render topicChip(e)}</div>
			{#if control !== 'tick'}<div class="mt-1 -ml-2 flex justify-start">
					{@render controls(e)}
				</div>{/if}
			{#if e.note}<div class="mt-1 truncate text-amber-700 dark:text-amber-400">
					✎ {e.note}
				</div>{/if}
		</div>
	</div>
{/snippet}

<section class="mt-4 pb-32">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h2 class="text-sm font-semibold">
			Sequence <span class="font-normal text-muted-foreground">{seq.entries.length} Lessons</span>
		</h2>
		<div class="relative flex gap-2">
			<Button size="sm" variant="outline" onclick={() => (adding = !adding)}>Add Lesson</Button>
			<Button size="sm" variant="outline" onclick={() => (assignOpen = !assignOpen)}
				>Assign Topic ▾</Button
			>
			{#if assignOpen}
				<div
					class="absolute top-full right-0 z-20 mt-1 w-80 rounded-lg border bg-popover p-1 text-sm shadow-lg"
				>
					{#each seq.topics as t (t.id)}
						{@const o = seq.overlap(t.id)}
						<button
							class="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-muted disabled:opacity-50"
							disabled={o.inSequence === o.total}
							onclick={() => {
								seq.assignTopic(t.id);
								assignOpen = false;
							}}
						>
							<span class="flex items-center gap-2">
								<span class="size-2.5 rounded-full" style:background-color={topicColour(t.id, 0.8)}
								></span>{t.name}
							</span>
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
				seq.addLesson(newTitle, newAfter === 'start' ? null : newAfter);
				newTitle = '';
				adding = false;
			}}
		>
			<input
				class="h-8 min-w-48 flex-1 rounded border bg-background px-2"
				placeholder="New Standalone Lesson title"
				bind:value={newTitle}
			/>
			<select class="h-8 max-w-64 rounded border bg-background px-1 text-xs" bind:value={newAfter}>
				<option value="start">First untaught</option>
				{#each untaught as o (o.id)}<option value={o.id}>After {indexOf(o.id)}. {o.title}</option
					>{/each}
			</select>
			<Button size="sm" type="submit">Add</Button>
		</form>
	{/if}

	{#if seq.message}
		<p
			role="status"
			class="mt-2 rounded-md px-3 py-2 text-xs {seq.message.tone === 'refused'
				? 'bg-destructive/10 text-destructive'
				: 'bg-amber-500/10'}"
		>
			{seq.message.text}
		</p>
	{/if}

	<button
		class="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
		onclick={() => (showTaught = !showTaught)}
	>
		<LockIcon class="size-3.5" />{seq.firstMovable} Lessons taught, fixed — {showTaught
			? 'hide'
			: 'show'}
	</button>

	{#if layout === 'list'}
		<ul class="mt-2 rounded-lg border">
			{#each visible as e, i (e.id)}
				{#if seq.pastEnd(e.id) && !seq.pastEnd(visible[i - 1]?.id ?? '')}
					<li class="border-b bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
						Past the end of the year{#if seq.layout.lastSlot}&nbsp;— the last Slot is {formatShortWeekday(
								seq.layout.lastSlot
							)}{/if}
					</li>
				{/if}
				{@render row(e)}
			{/each}
			{#if control === 'drag'}
				<li
					data-drop="end"
					class="px-3 py-2 text-xs text-muted-foreground {overId === 'end'
						? 'border-t-2 border-t-primary'
						: ''}"
				>
					Drop here to put a Lesson last
				</li>
			{/if}
		</ul>
	{:else}
		<div class="mt-2 space-y-1.5">
			{#each weeks as w (w.key)}
				<div
					class="flex gap-3 rounded-lg p-1.5 {w.key === 'past-end'
						? 'bg-destructive/10'
						: 'bg-muted/40'}"
				>
					<div
						class="w-20 shrink-0 pt-2 text-xs font-medium {w.key === 'past-end'
							? 'text-destructive'
							: 'text-muted-foreground'}"
					>
						{w.label}
					</div>
					<div class="flex min-w-0 flex-1 flex-wrap gap-1.5">
						{#each w.entries as e (e.id)}{@render card(e)}{/each}
					</div>
				</div>
			{/each}
			{#if control === 'drag'}
				<div
					data-drop="end"
					class="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground {overId ===
					'end'
						? 'border-primary'
						: ''}"
				>
					Drop here to put a Lesson last
				</div>
			{/if}
		</div>
	{/if}
</section>

{#if (control === 'tick' && selected.length) || (seq.draft && seq.dirty)}
	<div
		class="fixed inset-x-0 bottom-28 z-40 mx-auto flex w-fit max-w-[95vw] flex-wrap items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm shadow-xl"
	>
		{#if control === 'tick' && selected.length}
			<span class="font-medium">{selected.length} selected</span>
			<select
				class="h-8 max-w-56 rounded border bg-background px-1 text-xs"
				bind:value={tickTarget}
			>
				<option value="">Move after…</option>
				<option value="start">First untaught</option>
				{#each untaught.filter((o) => !selected.includes(o.id)) as o (o.id)}
					<option value={o.id}>{indexOf(o.id)}. {o.title}</option>
				{/each}
			</select>
			<Button
				size="sm"
				disabled={!tickTarget}
				onclick={() => {
					seq.moveAfter(
						seq.entries.filter((e) => selected.includes(e.id)).map((e) => e.id),
						tickTarget === 'start' ? null : tickTarget
					);
					selected = [];
					tickTarget = '';
				}}>Move</Button
			>
			<Button
				size="sm"
				variant="outline"
				onclick={() => {
					seq.remove(selected);
					selected = [];
				}}>Remove</Button
			>
		{/if}
		{#if seq.draft && seq.dirty}
			{#if control === 'tick' && selected.length}<span class="mx-1 h-5 w-px bg-border"></span>{/if}
			<span class="text-xs text-muted-foreground"
				>Not saved · {seq.changedCount} dates change{#if seq.pastEndCount}
					· {seq.pastEndCount} past the end{/if}</span
			>
			<Button size="sm" variant="ghost" onclick={() => seq.discard()}>Discard</Button>
			<Button size="sm" onclick={() => seq.save()}>Save order</Button>
		{/if}
	</div>
{/if}

{#if dragged}
	<div
		class="pointer-events-none fixed z-50 rounded-lg border bg-background px-2 py-1 text-xs font-medium shadow-lg"
		style:left="{pointer.x + 12}px"
		style:top="{pointer.y + 12}px"
	>
		{dragged.title}
	</div>
{/if}
