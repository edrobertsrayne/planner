<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { onFail, replaceQuery, submitForm } from '$lib/client/enhance';
	import { createSequenceDrag, type DragSnapshot } from '$lib/client/sequence-drag';
	import { lossSentence, type SequenceResult } from '$lib/sequence-text';
	import { layOutSequence, type SlotFill } from '$lib/sequence-layout';
	import { movedOrder } from '$lib/sequence-order';
	import { withParam } from '$lib/query';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import AssignTopicMenu from '$lib/components/assign-topic-menu.svelte';
	import { topicColour } from '$lib/topic-colour';
	import SequenceListRow from './SequenceListRow.svelte';
	import SequenceWeeks from './SequenceWeeks.svelte';
	import TopicTag from './TopicTag.svelte';
	import type { SequenceEntry, TopicChip, TopicOption, WeekRow } from '$lib/server/planner';

	// What this Class teaches, in the order it teaches it: its own Sequence (ADR-0026), By week or as
	// a List (`layout=list` in the address). Assign Topic adds a Topic's Lessons at the end; a tap on
	// a card opens the Lesson in its editor; a drag from the grip moves the Lesson onto another
	// Lesson's place: by week a drop takes the target's Slot, in the List a line shows the place.
	let {
		classId,
		classLabel,
		entries,
		topics,
		weeks,
		freeAfter,
		chips,
		sequenceResult
	}: {
		classId: string;
		classLabel: string;
		entries: SequenceEntry[];
		topics: TopicOption[];
		weeks: WeekRow[];
		freeAfter: number;
		chips: TopicChip[];
		// The last write's outcome: what to say, each Lesson that got a new first Slot, and the
		// Lessons to ring.
		sequenceResult: SequenceResult | null;
	} = $props();

	const byWeek = $derived(page.url.searchParams.get('layout') !== 'list');
	const setLayout = (layout: 'week' | 'list') =>
		replaceQuery(withParam(page.url, 'layout', layout));

	// The Lessons that × or bulk Remove asks about. The dialog stays until the write is done or Ed
	// cancels.
	let removing = $state<SequenceEntry[] | null>(null);

	// Select mode: a tap picks or clears a Lesson, a drag on a picked Lesson moves all picked ones,
	// and Done or Esc ends it. `chosen` is the selection in Sequence order, so a Lesson that left the
	// Sequence drops out of it by itself.
	let selectMode = $state(false);
	let selected = $state<string[]>([]);
	let refusal = $state<string | null>(null);
	const chosen = $derived(entries.filter((entry) => selected.includes(entry.lessonId)));
	const chosenIds = $derived(chosen.map((entry) => entry.lessonId));

	function endSelect() {
		selectMode = false;
		selected = [];
		refusal = null;
	}

	// A tap on a Lesson in select mode. A fixed Lesson cannot be selected.
	function pick(entry: SequenceEntry) {
		if (entry.fixed) {
			refusal = `“${entry.title}” was taught, so it cannot be selected.`;
			return;
		}
		refusal = null;
		selected = selected.includes(entry.lessonId)
			? selected.filter((id) => id !== entry.lessonId)
			: [...selected, entry.lessonId];
	}

	// Select on a Topic chip: select mode on, and the Topic's untaught Lessons added.
	function selectTopic(topicId: string) {
		selectMode = true;
		refusal = null;
		const ids = entries.filter((e) => e.topicId === topicId && !e.fixed).map((e) => e.lessonId);
		selected = [...selected, ...ids.filter((id) => !selected.includes(id))];
	}

	// In select mode a tap on a card picks it, and never follows the link.
	function tapCard(event: MouseEvent, entry: SequenceEntry) {
		if (!selectMode) return;
		event.preventDefault();
		pick(entry);
	}
	let moveForm = $state<HTMLFormElement | undefined>();
	// Add Lesson's inline title field: `row` is the place it opens (the toolbar's, or a week row),
	// `afterLessonId` the Lesson the new one follows (none: the first untaught place).
	let adding = $state<{ row: number | 'tab'; afterLessonId: string | null } | null>(null);

	// A drag starts at a grip and uses pointer events, so one path serves a mouse and a finger. The
	// grip has `touch-action: none`; the rest of the card still lets a finger scroll the page. The
	// engine in `$lib/client/sequence-drag` hit-tests the cards on each move and each auto-scroll
	// step, because a Lesson can scroll under a pointer that is still. A fixed Lesson has no grip
	// and no `data-drop`.
	let dragState = $state<DragSnapshot>({
		ids: [],
		grabbedId: null,
		overId: null,
		point: { x: 0, y: 0 }
	});
	const drag = createSequenceDrag({
		onChange: (snapshot) => (dragState = snapshot),
		onDrop: (lessonIds, target) => {
			submitForm(moveForm, { fields: { lessonIds: lessonIds.join(','), targetId: target } });
		}
	});
	const dragIds = $derived(dragState.ids);
	const overId = $derived(dragState.overId);
	const ghost = $derived(dragState.point);
	const dragging = $derived(dragState.ids.length > 0);
	const dragged = $derived(entries.find((entry) => entry.lessonId === dragState.grabbedId));
	const order = $derived(entries.map((entry) => entry.lessonId));
	// The new order if the drop happened now, or null when it would do nothing.
	const proposal = $derived(overId ? movedOrder(order, dragIds, overId) : null);
	// The drop line sits on the side of the target that the Lesson comes from.
	const lineAbove = $derived(!!overId && order.indexOf(overId) < order.indexOf(dragIds[0]));

	// By week: the Slots stay, and the Lessons that can still move go through them, as the order
	// lies now or, during a drag, as the drop would put them. Each Lesson that changes Slot is
	// outlined.
	const parts = $derived(new Map(entries.map((entry) => [entry.lessonId, entry.parts])));
	const slotKeys = $derived(
		weeks.flatMap((row) =>
			row.kind === 'week' ? row.cells.filter((c) => c.kind === 'movable').map((c) => c.key) : []
		)
	);
	const resting = $derived(layOutSequence(order, parts, slotKeys));
	const layout = $derived(proposal ? layOutSequence(proposal, parts, slotKeys) : resting);
	const firstSlotOf = (fills: Map<string, SlotFill>) => {
		const first: Record<string, string> = {};
		for (const [key, fill] of fills) first[fill.lessonId] ??= key;
		return first;
	};
	const changing = $derived.by(() => {
		const before = firstSlotOf(resting.fills);
		const after = firstSlotOf(layout.fills);
		return new Set(entries.map((e) => e.lessonId).filter((id) => before[id] !== after[id]));
	});
	// The Lessons past the end of the year stay listed during a drag, so the card under a finger
	// is never removed; one that the drop would push out joins them.
	const pastEndShown = $derived(
		entries
			.map((e) => e.lessonId)
			.filter((id) => resting.pastEnd.includes(id) || layout.pastEnd.includes(id))
	);

	// Each card whose first Slot changed in the last Move, with its old date.
	const was = $derived(new Map((sequenceResult?.changed ?? []).map((c) => [c.lessonId, c.was])));

	function dragStart(event: PointerEvent, lessonId: string) {
		if (dragging || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0))
			return;
		event.preventDefault();
		// A drag on a picked Lesson carries the selection, in its order; any other carries one Lesson.
		const ids = selectMode && chosenIds.includes(lessonId) ? chosenIds : [lessonId];
		drag.start(event, ids, lessonId);
	}
</script>

<svelte:window
	onpointermove={(event) => drag.move(event)}
	onpointerup={() => drag.end(true)}
	onpointercancel={() => drag.end(false)}
	onkeydown={(event) => {
		if (event.key !== 'Escape') return;
		if (dragging) drag.end(false);
		else if (selectMode && !removing) endSelect();
	}}
/>

<section class="mt-4">
	<div class="flex flex-wrap items-center gap-2">
		<h2 class="text-sm font-semibold">Sequence</h2>
		<div class="flex rounded-md border text-xs max-md:hidden" role="group" aria-label="Layout">
			{#each [['week', 'By week'], ['list', 'List']] as const as [layout, label] (layout)}
				<button
					type="button"
					class="px-2 py-1 first:rounded-l-md last:rounded-r-md {byWeek === (layout === 'week')
						? 'bg-muted font-medium'
						: 'text-muted-foreground hover:bg-muted/40'}"
					aria-pressed={byWeek === (layout === 'week')}
					onclick={() => setLayout(layout)}
				>
					{label}
				</button>
			{/each}
		</div>
		<div class="ml-auto flex items-center gap-2 max-md:hidden">
			<Button
				variant={selectMode ? 'default' : 'outline'}
				size="sm"
				class="h-7 text-xs"
				aria-pressed={selectMode}
				onclick={() => (selectMode ? endSelect() : (selectMode = true))}
			>
				<ListChecksIcon data-icon="inline-start" />{selectMode ? 'Done' : 'Select'}
			</Button>
			<Button
				variant="outline"
				size="sm"
				class="h-7 text-xs"
				onclick={() => (adding = { row: 'tab', afterLessonId: null })}
			>
				<PlusIcon data-icon="inline-start" />Add Lesson
			</Button>
			<AssignTopicMenu {classId} {topics} submit={onFail('Could not assign the Topic.')} />
		</div>
	</div>

	{#snippet addField()}
		<form
			method="POST"
			action="?/addLesson"
			class="flex items-center gap-2"
			data-add-lesson
			use:enhance={onFail('Could not add the Lesson.', () => (adding = null))}
		>
			<input type="hidden" name="classId" value={classId} />
			<input type="hidden" name="afterLessonId" value={adding?.afterLessonId ?? ''} />
			<Input
				name="title"
				required
				autofocus
				placeholder="Lesson title"
				aria-label="Title of the new Lesson"
				class="h-7 max-w-xs text-xs"
				onkeydown={(event) => event.key === 'Escape' && (adding = null)}
			/>
			<Button type="submit" size="sm" class="h-7 text-xs">Add</Button>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				class="h-7 text-xs"
				onclick={() => (adding = null)}
			>
				Cancel
			</Button>
		</form>
	{/snippet}

	<form
		method="POST"
		action="?/moveLessons"
		bind:this={moveForm}
		use:enhance={onFail('Could not move the Lesson.')}
	>
		<input type="hidden" name="classId" value={classId} />
		<input type="hidden" name="lessonIds" />
		<input type="hidden" name="targetId" />
	</form>

	{#if adding?.row === 'tab'}
		<div class="mt-2">{@render addField()}</div>
	{/if}

	{#if sequenceResult}
		<p
			class="mt-2 text-xs text-muted-foreground"
			role="status"
			{...{ [`data-${sequenceResult.kind}-result`]: true }}
		>
			{sequenceResult.lines.join(' ')}
		</p>
	{/if}

	{#if refusal}
		<p class="mt-2 text-xs text-destructive" role="status" data-select-refusal>{refusal}</p>
	{/if}

	{#if chips.length}
		<ul class="mt-3 flex flex-wrap gap-2" aria-label="Topics in this Sequence">
			{#each chips as chip (chip.topicId)}
				<li
					class="flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs"
					style:background-color={topicColour(chip.topicId, 0.12)}
					data-topic-chip
				>
					<TopicTag topicId={chip.topicId} name={chip.name} />
					<span class="text-muted-foreground tabular-nums" data-untaught>{chip.untaught}</span>
					<button
						type="button"
						class="rounded-full px-1.5 text-[11px] font-medium text-primary hover:bg-muted max-md:hidden"
						aria-label="Select {chip.name}"
						onclick={() => selectTopic(chip.topicId)}
					>
						Select
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	{#if byWeek}
		<SequenceWeeks
			{classId}
			{weeks}
			{freeAfter}
			{entries}
			pastEnd={pastEndShown}
			fills={layout.fills}
			resting={resting.fills}
			{changing}
			{dragIds}
			ringed={sequenceResult?.ringed ?? []}
			{was}
			{selectMode}
			selected={chosenIds}
			onTap={tapCard}
			onGrip={dragStart}
			onRemove={(entry) => (removing = [entry])}
			addingRow={adding?.row ?? null}
			onAdd={(row, afterLessonId) => (adding = { row, afterLessonId })}
			{addField}
		/>
		{#if entries.length === 0}
			<p class="mt-3 text-sm text-muted-foreground">
				No Lessons in this Sequence yet. Use Assign Topic to add a Topic's Lessons.
			</p>
		{/if}
	{:else}
		<ol class="mt-3 divide-y rounded-xl border" data-sequence>
			{#each entries as entry (entry.lessonId)}
				<SequenceListRow
					{classId}
					{entry}
					selected={chosenIds.includes(entry.lessonId)}
					dragging={dragIds.includes(entry.lessonId)}
					ringed={sequenceResult?.ringed.includes(entry.lessonId) ?? false}
					was={was.get(entry.lessonId)}
					{selectMode}
					dropLine={dragging && proposal && overId === entry.lessonId
						? lineAbove
							? 'above'
							: 'below'
						: null}
					onTap={tapCard}
					onGrip={dragStart}
					onRemove={(entry) => (removing = [entry])}
				/>
			{:else}
				<li class="px-3 py-4 text-sm text-muted-foreground">
					No Lessons in this Sequence yet. Use Assign Topic to add a Topic's Lessons.
				</li>
			{/each}
		</ol>
	{/if}
</section>

{#if dragged}
	<div
		class="pointer-events-none fixed z-50 rounded-lg border bg-background px-2 py-1 text-xs font-medium shadow-lg"
		style:left="{ghost.x + 12}px"
		style:top="{ghost.y + 12}px"
	>
		{dragIds.length > 1 ? `${dragIds.length} Lessons, from “${dragged.title}”` : dragged.title}
	</div>
{/if}

{#if selectMode}
	<div
		class="fixed inset-x-0 bottom-6 z-40 mx-auto flex w-fit max-w-[95vw] flex-wrap items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm shadow-xl"
		role="toolbar"
		aria-label="Selection"
		data-select-bar
	>
		<span class="font-medium" data-select-count>
			{chosen.length ? `${chosen.length} selected` : 'Tap Lessons to select'}
		</span>
		<Button
			size="sm"
			variant="outline"
			class="text-destructive"
			disabled={chosen.length === 0}
			onclick={() => (removing = chosen)}
		>
			Remove
		</Button>
		<Button size="sm" onclick={endSelect}>Done</Button>
	</div>
{/if}

<Dialog.Root
	open={removing !== null}
	onOpenChange={(open) => {
		if (!open) removing = null;
	}}
>
	<Dialog.Content class="sm:max-w-md">
		{#if removing}
			<Dialog.Header>
				<Dialog.Title>
					{removing.length === 1
						? `Remove “${removing[0].title}” from this Class?`
						: `Remove ${removing.length} Lessons from ${classLabel}?`}
				</Dialog.Title>
				<Dialog.Description>
					{lossSentence(removing)}
					{#each removing.filter((entry) => entry.onlyHere) as entry (entry.lessonId)}
						“{entry.title}” is in no other Class. After you remove it, you cannot add it to a Class
						again.
					{/each}
				</Dialog.Description>
			</Dialog.Header>
			<Dialog.Footer>
				<Button variant="outline" size="sm" class="h-7" onclick={() => (removing = null)}>
					Cancel
				</Button>
				<form
					method="POST"
					action="?/removeLessons"
					use:enhance={onFail('Could not remove.', () => {
						selected = selected.filter((id) => !removing?.some((e) => e.lessonId === id));
						removing = null;
					})}
				>
					<input type="hidden" name="classId" value={classId} />
					<input type="hidden" name="lessonIds" value={removing.map((e) => e.lessonId).join(',')} />
					<Button type="submit" variant="destructive" size="sm" class="h-7">Remove</Button>
				</form>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
