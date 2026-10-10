<script lang="ts">
	// PROTOTYPE, throwaway (#372, #382). One Class's Sequence, By week or List, moved by drag and
	// kept by Save. #382 adds select mode: a toggle; on, a tap selects and a drag on a selected
	// Lesson moves the whole selection; a bar offers bulk Remove.
	import CheckIcon from '@lucide/svelte/icons/check';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import LockIcon from '@lucide/svelte/icons/lock';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { addDays, formatDayMonth, formatShortWeekday, weekday } from '$lib/date';
	import { statusTone } from '$lib/feedback-tone';
	import {
		dateLabel,
		topicColour,
		type ProtoCell,
		type ProtoEntry,
		type ProtoSequence
	} from './prototype-sequence-state.svelte';

	let {
		seq,
		layout,
		control,
		classLabel,
		topicPanel
	}: {
		seq: ProtoSequence;
		layout: 'list' | 'weeks';
		control: 'buttons' | 'drag' | 'tick';
		classLabel: string;
		topicPanel: 'remove' | 'select';
	} = $props();

	// Select mode (#382). Off: a tap opens the Lesson, a drag moves one Lesson. On: a tap selects
	// or clears a Lesson; a drag on a selected Lesson moves the selection. Done or Esc ends it.
	let selectMode = $state(false);
	// A Remove waiting for the teacher to confirm: the Lessons and what the dialog calls them.
	let confirm = $state<{ ids: string[]; title: string } | null>(null);

	let showTaught = $state(false);
	let movingId = $state<string | null>(null);
	let selected = $state<string[]>([]);
	let adding = $state(false);
	let newTitle = $state('');
	let newAfter = $state('start');
	let assignOpen = $state(false);

	const untaught = $derived(seq.entries.slice(seq.firstMovable));
	const visible = $derived(showTaught ? seq.entries : untaught);
	const indexOf = (id: string) => seq.entries.findIndex((e) => e.id === id) + 1;

	// Pointer drag, for a mouse or a finger. A drop target is "l:<id>" (a Lesson in the list or
	// past the end), "s:<index>" (a Slot in the By week grid) or "end".
	let dragId = $state<string | null>(null);
	// The Lessons a drag carries: the selection, when the grabbed Lesson is in it.
	let dragIds = $state<string[]>([]);
	let overId = $state<string | null>(null);
	let pointer = $state({ x: 0, y: 0 });
	function dragStart(ev: PointerEvent, id: string) {
		ev.preventDefault();
		ev.stopPropagation();
		dragId = id;
		dragIds =
			selectMode && selected.includes(id)
				? seq.entries.filter((e) => selected.includes(e.id)).map((e) => e.id)
				: [id];
		pointer = { x: ev.clientX, y: ev.clientY };
	}
	function dragMove(ev: PointerEvent) {
		if (!dragId) return;
		pointer = { x: ev.clientX, y: ev.clientY };
		const el = document
			.elementFromPoint(ev.clientX, ev.clientY)
			?.closest<HTMLElement>('[data-drop]');
		const drop = el?.dataset.drop ?? null;
		if (el && drop?.startsWith('s:')) {
			// A card over two Slots (a double): the half under the pointer is the Slot.
			const span = Number(el.dataset.span ?? 1);
			const r = el.getBoundingClientRect();
			const k = Math.min(span - 1, Math.floor(((ev.clientX - r.left) / r.width) * span));
			overId = `s:${Number(drop.slice(2)) + k}`;
		} else overId = drop;
	}

	// The Slots as the present order fills them. A Slot target means the Lesson in that Slot now,
	// so the target never changes while the preview moves cards around under the pointer.
	const committed = $derived(seq.fill(seq.entries));
	const target = $derived.by(() => {
		if (!overId) return null;
		if (overId === 'end') return 'end';
		if (overId.startsWith('l:')) return overId.slice(2);
		return committed.cells[Number(overId.slice(2))]?.lessonId ?? 'end';
	});
	const proposal = $derived.by(() => {
		if (!dragId || !target || dragIds.includes(target)) return null;
		return seq.groupOrder(dragIds, dragId, target);
	});
	const refusal = $derived(typeof proposal === 'string' ? proposal : null);
	const preview = $derived(Array.isArray(proposal) ? proposal : null);
	const shown = $derived(preview ? seq.fill(preview) : committed);

	function dragEnd() {
		if (dragId && preview && target) seq.moveGroup(dragIds, dragId, target);
		dragId = null;
		dragIds = [];
		overId = null;
	}

	// The By week grid: every Teaching Week with its Slots in fixed positions. A double that sits
	// in two touching Periods of one day is one card over two Slots.
	type Card = { lessonId: string | null; cells: ProtoCell[]; first: number };
	type Row =
		| { kind: 'week'; key: string; letter: 'A' | 'B'; cards: Card[]; slots: number }
		| { kind: 'holiday'; key: string }
		| { kind: 'past-end'; key: string; ids: string[] };
	const mondayOf = (d: string) => addDays(d, 1 - weekday(d));
	const taughtCells = $derived.by(() => {
		const inStream = new Set(seq.layout.stream.map((s) => `${s.date}|${s.period}`));
		const out: ProtoCell[] = [];
		for (const e of seq.entries) {
			if (!seq.isLocked(e.id)) continue;
			const parts = seq.layout.parts[e.id] ?? [];
			const of = parts.length + (seq.layout.unplaced[e.id] ?? 0);
			parts.forEach((p, i) => {
				if (!inStream.has(`${p.date}|${p.period}`))
					out.push({ ...p, lessonId: e.id, part: i + 1, of });
			});
		}
		return out;
	});
	const grid = $derived.by(() => {
		const stream = shown.cells.map((c, i) => ({ c, i }));
		const lastFilled = stream.findLast(({ c }) => c.lessonId)?.c.date ?? stream[0]?.c.date;
		const start = mondayOf(
			showTaught && taughtCells.length
				? taughtCells.reduce((m, c) => (c.date < m ? c.date : m), taughtCells[0].date)
				: (stream[0]?.c.date ?? '9999')
		);
		const weeks = seq.layout.weeks.filter((w) => w.weekCommencing >= start);
		// One week of free Slots after the last Lesson, so there is room to drop at the end.
		const lastIndex = weeks.findIndex((w) => lastFilled && w.weekCommencing > lastFilled);
		const showWeeks = lastIndex === -1 ? weeks : weeks.slice(0, lastIndex + 1);
		const rows: Row[] = [];
		for (const [n, w] of showWeeks.entries()) {
			const prev = showWeeks[n - 1];
			if (prev && addDays(prev.weekCommencing, 7) < w.weekCommencing)
				rows.push({ kind: 'holiday', key: `h-${w.weekCommencing}` });
			const cells = [
				...taughtCells
					.filter((c) => mondayOf(c.date) === w.weekCommencing)
					.map((c) => ({ c, i: -1 })),
				...stream.filter(({ c }) => mondayOf(c.date) === w.weekCommencing)
			].sort((a, b) => a.c.date.localeCompare(b.c.date) || a.c.period - b.c.period);
			const cards: Card[] = [];
			for (const { c, i } of cells) {
				const last = cards.at(-1);
				const prevCell = last?.cells.at(-1);
				if (
					last &&
					prevCell &&
					c.lessonId &&
					last.lessonId === c.lessonId &&
					prevCell.date === c.date &&
					prevCell.period + 1 === c.period
				)
					last.cells.push(c);
				else cards.push({ lessonId: c.lessonId, cells: [c], first: i });
			}
			rows.push({
				kind: 'week',
				key: w.weekCommencing,
				letter: w.letter,
				cards,
				slots: cells.length
			});
		}
		if (shown.pastEnd.length) rows.push({ kind: 'past-end', key: 'past-end', ids: shown.pastEnd });
		const hiddenFree =
			showWeeks.length < weeks.length
				? stream.filter(({ c }) => c.date >= addDays(showWeeks.at(-1)!.weekCommencing, 7)).length
				: 0;
		return {
			rows,
			columns: Math.max(1, ...rows.map((r) => (r.kind === 'week' ? r.slots : 1))),
			hiddenFree
		};
	});
	const entryOf = (id: string) => seq.entries.find((e) => e.id === id)!;
	const cellLabel = (cells: ProtoCell[]) =>
		dateLabel(cells[0]) + (cells.length > 1 ? `–${cells.at(-1)!.period}` : '');
	let addingWeek = $state<string | null>(null);
	const dragged = $derived(seq.entries.find((e) => e.id === dragId));

	const toggle = (id: string) =>
		(selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

	// A tap on a Lesson: in select mode it selects or clears; otherwise it opens the Lesson.
	function tap(e: ProtoEntry) {
		if (!selectMode) {
			seq.message = { tone: 'ok', text: `A tap opens “${e.title}” in the Lesson editor.` };
			return;
		}
		if (seq.isLocked(e.id)) {
			seq.message = { tone: 'refused', text: `“${e.title}” was taught, so it cannot be selected.` };
			return;
		}
		toggle(e.id);
	}
	function endSelect() {
		selectMode = false;
		selected = [];
	}

	// The Topics this Sequence holds, in order of their first Lesson, with their untaught Lessons.
	const topicsHere = $derived.by(() => {
		const out: { id: string; name: string; untaught: string[]; total: number }[] = [];
		for (const [i, e] of seq.entries.entries()) {
			if (!e.topicId) continue;
			let t = out.find((x) => x.id === e.topicId);
			if (!t) out.push((t = { id: e.topicId, name: e.topicName ?? '', untaught: [], total: 0 }));
			t.total++;
			if (i >= seq.firstMovable) t.untaught.push(e.id);
		}
		return out;
	});
	function selectTopic(ids: string[]) {
		selectMode = true;
		selected = [...selected, ...ids.filter((id) => !selected.includes(id))];
	}
	const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
	const confirmLoss = $derived(confirm ? seq.loss(confirm.ids) : null);
</script>

<svelte:window
	onpointermove={dragMove}
	onpointerup={dragEnd}
	onpointercancel={dragEnd}
	onkeydown={(ev) => {
		if (ev.key === 'Escape' && selectMode && !confirm) endSelect();
	}}
/>

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
	{:else if control === 'drag' && !selectMode}
		<div class="flex shrink-0 items-center">
			<Button
				variant="ghost"
				size="icon-sm"
				onclick={(ev) => {
					ev.stopPropagation();
					seq.remove([e.id]);
				}}
				aria-label="Remove {e.title} from this Class"><XIcon class="size-3.5" /></Button
			>
		</div>
	{:else if control === 'drag'}
		<span class="w-8 shrink-0"></span>
	{/if}
{/snippet}

{#snippet lead(e: ProtoEntry)}
	{#if seq.isLocked(e.id)}
		<span class="w-5 shrink-0"></span>
	{:else if control === 'drag'}
		<button
			class="flex w-5 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground"
			onpointerdown={(ev) => dragStart(ev, e.id)}
			onclick={(ev) => ev.stopPropagation()}
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

{#snippet check(e: ProtoEntry)}
	{#if selectMode && !seq.isLocked(e.id)}
		<span
			class="flex size-5 shrink-0 items-center justify-center rounded-full {selected.includes(e.id)
				? 'bg-primary text-primary-foreground'
				: ''}"
			>{#if selected.includes(e.id)}<CheckIcon class="size-3.5" />{/if}</span
		>
	{/if}
{/snippet}

{#snippet row(e: ProtoEntry)}
	{@const locked = seq.isLocked(e.id)}
	{@const down = indexOf(e.id) > indexOf(dragId ?? '')}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
	<li
		data-drop={locked ? undefined : `l:${e.id}`}
		onclick={() => tap(e)}
		class="flex items-center gap-3 border-b px-2 py-2 text-sm transition-colors select-none
			{locked ? 'text-muted-foreground' : ''}
			{selectMode ? (locked ? 'cursor-not-allowed' : 'cursor-pointer') : 'cursor-pointer'}
			{seq.lastMoved.includes(e.id) && !selected.includes(e.id) ? 'bg-amber-500/10' : ''}
			{selected.includes(e.id) ? 'bg-primary/15' : ''}
			{dragIds.includes(e.id) ? 'opacity-40' : ''}
			{preview && target === e.id
			? down
				? 'border-b-2 border-b-primary'
				: 'border-t-2 border-t-primary'
			: ''}"
	>
		{@render lead(e)}
		{@render check(e)}
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
		{@render statusToggle(e)}
		{@render controls(e)}
	</li>
{/snippet}

<!-- The same Draft/Planned toggle as Planning's stream. -->
{#snippet statusToggle(e: ProtoEntry)}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
	<div
		class="flex shrink-0 overflow-hidden rounded-md border text-xs"
		role="group"
		onclick={(ev) => ev.stopPropagation()}
	>
		{#each [{ key: 'planned', name: 'Planned' }, { key: 'draft', name: 'Draft' }] as const as rung (rung.key)}
			{@const on = e.status === rung.key}
			{@const tone = statusTone(rung.key)}
			<button
				aria-pressed={on}
				class="px-2 py-1.5 font-medium transition-colors {on
					? ''
					: 'text-muted-foreground hover:bg-muted'}"
				style:background-color={on ? tone.bg : undefined}
				style:color={on ? tone.fg : undefined}
				onclick={() => seq.setStatus(e.id, rung.key)}>{rung.name}</button
			>
		{/each}
	</div>
{/snippet}

{#snippet slotCard(c: Card)}
	{#if c.lessonId === null}
		<div
			data-drop="s:{c.first}"
			class="flex min-h-16 items-start rounded-lg border border-dashed p-2 text-xs text-muted-foreground"
		>
			<span class="tabular-nums">{cellLabel(c.cells)}</span>
			<span class="ml-auto">Free</span>
		</div>
	{:else}
		{@const e = entryOf(c.lessonId)}
		{@const locked = seq.isLocked(e.id)}
		{@const isDragged = dragIds.includes(e.id)}
		{@const isSelected = selected.includes(e.id)}
		{@const shifted =
			!!preview &&
			!isDragged &&
			!locked &&
			(c.first >= 0
				? committed.cells[c.first]?.lessonId !== e.id
				: !committed.pastEnd.includes(e.id))}
		{@const now = seq.first(e.id)}
		{@const showWas =
			!preview &&
			seq.changed(e.id) &&
			(c.cells.length === 0 ||
				(now?.date === c.cells[0].date && now?.period === c.cells[0].period))}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div
			data-drop={locked ? undefined : c.first >= 0 ? `s:${c.first}` : `l:${e.id}`}
			data-span={Math.max(1, c.cells.length)}
			onclick={() => tap(e)}
			class="relative flex min-h-16 min-w-0 rounded-lg border text-xs transition select-none
				{c.first === -2 ? 'w-56' : ''}
				{locked ? 'opacity-60' : ''}
				{selectMode ? (locked ? 'cursor-not-allowed' : 'cursor-pointer') : 'cursor-pointer'}
				{isDragged ? (preview ? 'ring-2 ring-primary' : 'opacity-40') : ''}
				{shifted ? 'outline-2 outline-amber-500 outline-dashed' : ''}
				{!dragId && !isSelected && seq.lastMoved.includes(e.id) ? 'ring-2 ring-amber-500' : ''}
				{isSelected && !dragId ? 'border-primary ring-2 ring-primary' : ''}"
			style:grid-column="span {Math.max(1, c.cells.length)}"
			style:background-color={topicColour(e.topicId, isSelected ? 0.45 : 0.22)}
		>
			{#if locked}
				<span class="flex w-5 shrink-0 items-start justify-center pt-2"
					><LockIcon class="size-3 text-muted-foreground" aria-label="Taught, fixed" /></span
				>
			{:else}
				<div class="flex pt-1.5 pl-0.5">{@render lead(e)}</div>
			{/if}
			<div class="min-w-0 flex-1 py-1.5 pr-5">
				<div class="truncate text-muted-foreground tabular-nums">
					{c.cells.length
						? cellLabel(c.cells)
						: 'No Slot left'}{#if c.cells.length && c.cells[0].of > 1 && c.cells.length < c.cells[0].of}&nbsp;·
						part
						{c.cells[0].part} of {c.cells[0].of}{/if}
				</div>
				{#if showWas}
					<div class="truncate text-amber-700 tabular-nums dark:text-amber-400">
						was {seq.was(e.id) ? dateLabel(seq.was(e.id)) : 'past the end'}
					</div>
				{/if}
				<div class="truncate font-medium">{e.title}</div>
				<div class="truncate opacity-70">{e.topicName ?? 'Standalone Lesson'}</div>
				{#if e.note}<div class="truncate text-amber-700 dark:text-amber-400">✎ {e.note}</div>{/if}
				{#if control === 'buttons' && !locked}<div class="-ml-2">{@render controls(e)}</div>{/if}
			</div>
			{#if !locked && control !== 'buttons' && !selectMode}
				<button
					class="absolute top-0.5 right-0.5 rounded p-0.5 text-muted-foreground hover:bg-foreground/10"
					onclick={(ev) => {
						ev.stopPropagation();
						seq.remove([e.id]);
					}}
					aria-label="Remove {e.title} from this Class"><XIcon class="size-3" /></button
				>
			{:else if selectMode && isSelected}
				<span
					class="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
					><CheckIcon class="size-3" /></span
				>
			{/if}
		</div>
	{/if}
{/snippet}

<section class="mt-4 pb-32">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h2 class="text-sm font-semibold">
			Sequence <span class="font-normal text-muted-foreground">{seq.entries.length} Lessons</span>
		</h2>
		<div class="relative flex gap-2">
			<Button
				size="sm"
				variant={selectMode ? 'default' : 'outline'}
				aria-pressed={selectMode}
				onclick={() => (selectMode ? endSelect() : (selectMode = true))}
				><ListChecksIcon class="size-4" />{selectMode ? 'Done' : 'Select'}</Button
			>
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

	<!-- The Topic panel (#382): (a) Remove Topic, or (c) Select, which turns select mode on. -->
	{#if topicsHere.length}
		<div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
			<span class="text-muted-foreground">Topics in this Sequence</span>
			{#each topicsHere as t (t.id)}
				<span
					class="flex items-center gap-1.5 rounded-full border py-0.5 pr-0.5 pl-2"
					style:background-color={topicColour(t.id, 0.15)}
				>
					<span class="size-2 rounded-full" style:background-color={topicColour(t.id, 0.8)}></span>
					<span class="font-medium">{t.name}</span>
					<span class="text-muted-foreground">{t.untaught.length} untaught</span>
					{#if topicPanel === 'remove'}
						<button
							class="rounded-full px-2 py-0.5 hover:bg-destructive/15 hover:text-destructive disabled:opacity-40"
							disabled={!t.untaught.length}
							onclick={() =>
								(confirm = { ids: t.untaught, title: `Remove ${t.name} from ${classLabel}?` })}
							>Remove Topic</button
						>
					{:else}
						<button
							class="rounded-full px-2 py-0.5 hover:bg-primary/15 disabled:opacity-40"
							disabled={!t.untaught.length}
							onclick={() => selectTopic(t.untaught)}>Select</button
						>
					{/if}
				</span>
			{/each}
		</div>
	{/if}

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
			{#each grid.rows as r (r.key)}
				{#if r.kind === 'holiday'}
					<div class="px-2 text-xs text-muted-foreground">Holiday</div>
				{:else if r.kind === 'past-end'}
					<div class="flex gap-3 rounded-lg bg-destructive/10 p-1.5">
						<div class="w-24 shrink-0 pt-2 text-xs font-medium text-destructive">
							Past the end of the year
						</div>
						<div class="flex min-w-0 flex-1 flex-wrap gap-1.5">
							{#each r.ids as id (id)}{@render slotCard({
									lessonId: id,
									cells: [],
									first: -2
								})}{/each}
						</div>
					</div>
				{:else}
					<div class="flex gap-3 rounded-lg bg-muted/40 p-1.5">
						<div class="w-24 shrink-0 pt-2 text-xs text-muted-foreground">
							<div class="font-medium">w/c {formatDayMonth(r.key)}</div>
							<div>Week {r.letter} · {r.slots} {r.slots === 1 ? 'Slot' : 'Slots'}</div>
							<button
								class="mt-1 flex items-center gap-0.5 rounded px-1 hover:bg-foreground/10 hover:text-foreground"
								onclick={() => (addingWeek = addingWeek === r.key ? null : r.key)}
								aria-label="Add a Lesson in the week of {formatDayMonth(r.key)}"
								><PlusIcon class="size-3" />Add</button
							>
						</div>
						{#if r.cards.length}
							<div
								class="grid min-w-0 flex-1 gap-1.5"
								style:grid-template-columns="repeat({grid.columns}, minmax(0, 1fr))"
							>
								{#each r.cards as c (c.cells[0].date + c.cells[0].period)}{@render slotCard(
										c
									)}{/each}
							</div>
						{:else}
							<div class="flex-1 pt-2 text-xs text-muted-foreground">No Slots this week</div>
						{/if}
					</div>
					{#if addingWeek === r.key}
						<form
							class="ml-28 flex gap-2"
							onsubmit={(ev) => {
								ev.preventDefault();
								const end = addDays(r.key, 7);
								const after =
									committed.cells.findLast(
										(x) => x.lessonId && x.date < end && !seq.isLocked(x.lessonId)
									)?.lessonId ?? null;
								seq.addLesson(newTitle, after);
								newTitle = '';
								addingWeek = null;
							}}
						>
							<input
								class="h-8 flex-1 rounded border bg-background px-2 text-sm"
								placeholder="New Standalone Lesson title"
								bind:value={newTitle}
							/>
							<Button size="sm" type="submit">Add</Button>
							<Button size="sm" variant="ghost" onclick={() => (addingWeek = null)}>Cancel</Button>
						</form>
					{/if}
				{/if}
			{/each}
			{#if grid.hiddenFree}
				<p class="px-2 text-xs text-muted-foreground">
					{grid.hiddenFree} more free Slots to the end of the year{#if seq.layout.lastSlot}. The
						last Slot is {formatShortWeekday(seq.layout.lastSlot)}{/if}.
				</p>
			{/if}
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

{#if selectMode || (seq.draft && seq.dirty)}
	<div
		class="fixed inset-x-0 bottom-28 z-40 mx-auto flex w-fit max-w-[95vw] flex-wrap items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm shadow-xl"
	>
		{#if selectMode}
			<span class="font-medium"
				>{selected.length ? `${selected.length} selected` : 'Tap Lessons to select'}</span
			>
			<Button
				size="sm"
				variant="outline"
				class="text-destructive"
				disabled={!selected.length}
				onclick={() =>
					(confirm = {
						ids: seq.entries.filter((e) => selected.includes(e.id)).map((e) => e.id),
						title: `Remove ${plural(selected.length, 'Lesson')} from ${classLabel}?`
					})}>Remove</Button
			>
			<Button size="sm" onclick={endSelect}>Done</Button>
		{/if}
		{#if seq.draft && seq.dirty}
			{#if selectMode}<span class="mx-1 h-5 w-px bg-border"></span>{/if}
			<span class="text-xs text-muted-foreground"
				>Not saved · {seq.changedCount} dates change{#if seq.pastEndCount}&nbsp;· {seq.pastEndCount} past
					the end{/if}</span
			>
			<Button size="sm" variant="ghost" onclick={() => seq.discard()}>Discard</Button>
			<Button size="sm" onclick={() => seq.save()}>Save order</Button>
		{/if}
	</div>
{/if}

<!-- Bulk Remove and Remove Topic ask first: the count, then the notes and Ready marks lost. -->
<Dialog.Root
	open={confirm !== null}
	onOpenChange={(open) => {
		if (!open) confirm = null;
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{confirm?.title}</Dialog.Title>
			<Dialog.Description>
				{#if confirmLoss && (confirmLoss.notes || confirmLoss.ready)}
					{[
						confirmLoss.notes ? plural(confirmLoss.notes, 'note') : '',
						confirmLoss.ready ? plural(confirmLoss.ready, 'Ready mark') : ''
					]
						.filter(Boolean)
						.join(' and ')} will be lost.
				{:else}
					No notes or Ready marks will be lost.
				{/if}
				Later Lessons move up into the free Slots. The Lessons themselves stay in their Topics.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" size="sm" onclick={() => (confirm = null)}>Cancel</Button>
			<Button
				variant="destructive"
				size="sm"
				onclick={() => {
					if (!confirm) return;
					seq.remove(confirm.ids);
					selected = selected.filter((id) => !confirm!.ids.includes(id));
					confirm = null;
				}}>Remove {confirmLoss ? plural(confirmLoss.lessons, 'Lesson') : ''}</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

{#if dragged}
	<div
		class="pointer-events-none fixed z-50 rounded-lg border bg-background px-2 py-1 text-xs font-medium shadow-lg"
		style:left="{pointer.x + 12}px"
		style:top="{pointer.y + 12}px"
	>
		{dragIds.length > 1 ? `${dragIds.length} Lessons, from “${dragged.title}”` : dragged.title}
		{#if refusal}<span class="block font-normal text-destructive">{refusal}</span>{/if}
	</div>
{/if}
