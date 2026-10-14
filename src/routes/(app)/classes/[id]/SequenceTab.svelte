<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import CheckIcon from '@lucide/svelte/icons/check';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import LockIcon from '@lucide/svelte/icons/lock';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import { failureReason, onFail, replaceQuery, submitWithValue } from '$lib/client/enhance';
	import { layOutSequence, type SlotFill } from '$lib/sequence-layout';
	import { movedOrder } from '$lib/sequence-order';
	import { withParam } from '$lib/query';
	import { formatDateShort } from '$lib/date';
	import Markdown from '$lib/components/markdown.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { toast } from 'svelte-sonner';
	import { topicColour } from '$lib/topic-colour';
	import SequenceWeeks from './SequenceWeeks.svelte';
	import type {
		DateChange,
		SequenceEntry,
		SkipReason,
		TopicChip,
		TopicOption,
		WeekRow
	} from '$lib/server/planner';

	// What this Class teaches, in the order it teaches it: its own Sequence (ADR-0026), By week or as
	// a List (`layout=list` in the address). Assign Topic adds a Topic's Lessons at the end; a tap on
	// a card opens the Lesson in its editor; a drag from the grip moves the Lesson onto another
	// Lesson's place: by week a drop takes the target's Slot, in the List a line shows the place.
	let {
		classId,
		entries,
		topics,
		weeks,
		freeAfter,
		pastEnd,
		chips,
		result,
		moved,
		removed,
		added
	}: {
		classId: string;
		entries: SequenceEntry[];
		topics: TopicOption[];
		weeks: WeekRow[];
		freeAfter: number;
		pastEnd: string[];
		chips: TopicChip[];
		result: {
			topicName: string;
			added: number;
			skipped: { title: string; reason: SkipReason }[];
		} | null;
		// The last Move: the Lessons moved, and each Lesson that got a new first Slot.
		moved: { lessonIds: string[]; changed: DateChange[]; lessonsChanged: number } | null;
		removed: { count: number; changed: number } | null;
		added: { title: string; changed: number } | null;
	} = $props();

	const byWeek = $derived(page.url.searchParams.get('layout') !== 'list');
	const setLayout = (layout: 'week' | 'list') =>
		replaceQuery(withParam(page.url, 'layout', layout === 'list' ? 'list' : null));

	let assignForm = $state<HTMLFormElement | undefined>();
	// The Lesson that × asks about. The dialog stays until the write is done or Ed cancels.
	let removing = $state<SequenceEntry | null>(null);
	let moveForm = $state<HTMLFormElement | undefined>();
	// Add Lesson's inline title field: `row` is the place it opens (the toolbar's, or a week row),
	// `afterLessonId` the Lesson the new one follows (none: the first untaught place).
	let adding = $state<{ row: number | 'tab'; afterLessonId: string | null } | null>(null);

	// A drag starts at a grip and uses pointer events, so one path serves a mouse and a finger. The
	// grip has `touch-action: none`; the rest of the card still lets a finger scroll the page. The
	// pointer is hit-tested on each move and on each auto-scroll step, because a Lesson can scroll
	// under a pointer that is still. A fixed Lesson has no grip and no `data-drop`.
	const EDGE = 80;
	const SCROLL_STEP = 16;
	let dragIds = $state<string[]>([]);
	let overId = $state<string | null>(null);
	let pointer = { x: 0, y: 0 };
	let ghost = $state({ x: 0, y: 0 });
	let scrolling = 0;

	const dragging = $derived(dragIds.length > 0);
	const dragged = $derived(entries.find((entry) => entry.lessonId === dragIds[0]));
	const order = $derived(entries.map((entry) => entry.lessonId));
	// The new order if the drop happened now, or null when it would do nothing.
	const proposal = $derived(overId ? movedOrder(order, dragIds, overId) : null);
	// The drop line sits on the side of the target that the Lesson comes from.
	const lineAbove = $derived(!!overId && order.indexOf(overId) < order.indexOf(dragIds[0]));

	// By week: the Slots stay, and the Lessons that can still move go through them. During a drag,
	// the Lessons lie as the drop would put them, and each that changes Slot is outlined.
	const byId = $derived(new Map(entries.map((entry) => [entry.lessonId, entry])));
	const cells = $derived(weeks.flatMap((row) => (row.kind === 'week' ? row.cells : [])));
	const current = $derived(
		new Map<string, SlotFill>(
			cells.flatMap((cell) =>
				cell.kind === 'lesson' && cell.lessonId
					? [[cell.key, { lessonId: cell.lessonId, part: cell.part, of: cell.of }] as const]
					: []
			)
		)
	);
	const preview = $derived(
		dragging && proposal
			? layOutSequence(
					proposal.flatMap((id) => {
						const entry = byId.get(id);
						return entry && !entry.fixed ? [{ lessonId: id, parts: entry.parts }] : [];
					}),
					cells.filter((c) => c.kind === 'lesson' || c.kind === 'free').map((c) => c.key)
				)
			: null
	);
	const firstSlotOf = (fills: Map<string, SlotFill>) => {
		const first: Record<string, string> = {};
		for (const [key, fill] of fills) first[fill.lessonId] ??= key;
		return first;
	};
	const changing = $derived.by(() => {
		if (!preview) return new Set<string>();
		const before = firstSlotOf(current);
		const after = firstSlotOf(preview.fills);
		return new Set(
			entries
				.filter((e) => !e.fixed && before[e.lessonId] !== after[e.lessonId])
				.map((e) => e.lessonId)
		);
	});
	// The Lessons past the end of the year stay listed during a drag, so the card under a finger
	// is never removed; one that the drop would push out joins them.
	const pastEndShown = $derived(
		preview
			? entries
					.filter((e) => pastEnd.includes(e.lessonId) || preview.pastEnd.includes(e.lessonId))
					.map((e) => e.lessonId)
			: pastEnd
	);

	function hitTest() {
		const el = document.elementFromPoint(pointer.x, pointer.y)?.closest<HTMLElement>('[data-drop]');
		overId = el?.dataset.drop ?? null;
	}

	// Each card whose first Slot changed in the last Move, with its old date.
	const was = $derived(new Map((moved?.changed ?? []).map((c) => [c.lessonId, c.was])));

	function dragStart(event: PointerEvent, lessonId: string) {
		event.preventDefault();
		dragIds = [lessonId];
		pointer = { x: event.clientX, y: event.clientY };
		ghost = pointer;
		scrolling = requestAnimationFrame(scrollLoop);
	}

	function dragMove(event: PointerEvent) {
		if (!dragging) return;
		pointer = { x: event.clientX, y: event.clientY };
		ghost = pointer;
		hitTest();
	}

	// Near the top or bottom edge of the window, scroll a step and hit-test again.
	function scrollLoop() {
		const step =
			pointer.y < EDGE ? -SCROLL_STEP : pointer.y > window.innerHeight - EDGE ? SCROLL_STEP : 0;
		if (step !== 0) {
			window.scrollBy(0, step);
			hitTest();
		}
		scrolling = requestAnimationFrame(scrollLoop);
	}

	function dragEnd(drop: boolean) {
		cancelAnimationFrame(scrolling);
		const target = overId;
		const lessonIds = dragIds;
		const dropped = drop && proposal && target;
		dragIds = [];
		overId = null;
		if (!dropped || !moveForm) return;
		(moveForm.elements.namedItem('lessonIds') as HTMLInputElement).value = lessonIds.join(',');
		submitWithValue(moveForm, 'targetId', target);
	}

	// What a removal costs: the Teaching note and Ready mark of this Class and Lesson go with it.
	function losses(entry: SequenceEntry): string {
		const lost = [entry.note ? 'Teaching note' : null, entry.ready ? 'Ready mark' : null].filter(
			(item) => item !== null
		);
		return lost.length
			? `The ${lost.join(' and the ')} of this Lesson in this Class will be lost.`
			: 'No notes or Ready marks will be lost.';
	}

	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
	const REASONS: Record<SkipReason, string> = {
		'in-sequence': 'already in this Sequence',
		placed: 'Placed on this Class'
	};
</script>

<svelte:window
	onpointermove={dragMove}
	onpointerup={() => dragEnd(true)}
	onpointercancel={() => dragEnd(false)}
	onkeydown={(event) => event.key === 'Escape' && dragging && dragEnd(false)}
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
		<Button
			variant="outline"
			size="sm"
			class="ml-auto h-7 text-xs max-md:hidden"
			onclick={() => (adding = { row: 'tab', afterLessonId: null })}
		>
			<PlusIcon data-icon="inline-start" />Add Lesson
		</Button>
		<form
			method="POST"
			action="?/assignTopic"
			class="max-md:hidden"
			bind:this={assignForm}
			use:enhance={onFail('Could not assign the Topic.')}
		>
			<input type="hidden" name="classId" value={classId} />
			<input type="hidden" name="topicId" />
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="outline" size="sm" class="h-7 text-xs">
							<PlusIcon data-icon="inline-start" />Assign Topic
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end">
					{#each topics as topic (topic.id)}
						{@const all = topic.counted === topic.lessonCount}
						<DropdownMenu.Item
							disabled={all}
							onSelect={() => submitWithValue(assignForm, 'topicId', topic.id)}
						>
							{topic.name} ·
							{all ? 'all' : `${topic.counted} of ${topic.lessonCount}`} in Sequence or Placed
						</DropdownMenu.Item>
					{:else}
						<DropdownMenu.Item disabled>This Course has no Topics yet.</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</form>
	</div>

	{#snippet addField()}
		<form
			method="POST"
			action="?/addLesson"
			class="flex items-center gap-2"
			data-add-lesson
			use:enhance={() =>
				async ({ result, update }) => {
					if (result.type === 'failure') {
						toast.error(failureReason(result, 'Could not add the Lesson.'));
					} else {
						adding = null;
						await update({ invalidateAll: true });
					}
				}}
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

	{#if moved}
		<p class="mt-2 text-xs text-muted-foreground" role="status" data-move-result>
			{moved.lessonsChanged === 0
				? 'No Lessons change date.'
				: `${plural(moved.lessonsChanged, 'Lesson')} ${moved.lessonsChanged === 1 ? 'changes' : 'change'} date.`}
		</p>
	{/if}

	{#if result}
		<p class="mt-2 text-xs text-muted-foreground" role="status" data-assign-result>
			{result.added === 0
				? `Added no Lessons from ${result.topicName}.`
				: `Added ${plural(result.added, 'Lesson')} from ${result.topicName}.`}
			{#each result.skipped as skip (skip.title)}
				Skipped “{skip.title}”: {REASONS[skip.reason]}.
			{/each}
		</p>
	{/if}

	{#if added}
		<p class="mt-2 text-xs text-muted-foreground" role="status" data-add-result>
			Added “{added.title}”.
			{added.changed === 0
				? 'No Lessons change date.'
				: `${plural(added.changed, 'Lesson')} ${added.changed === 1 ? 'changes' : 'change'} date.`}
		</p>
	{/if}

	{#if removed}
		<p class="mt-2 text-xs text-muted-foreground" role="status" data-remove-result>
			Removed {plural(removed.count, 'Lesson')}.
			{removed.changed === 0
				? 'No Lessons change date.'
				: `${plural(removed.changed, 'Lesson')} ${removed.changed === 1 ? 'changes' : 'change'} date.`}
		</p>
	{/if}

	{#if chips.length}
		<ul class="mt-3 flex flex-wrap gap-2" aria-label="Topics in this Sequence">
			{#each chips as chip (chip.topicId)}
				<li
					class="flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs"
					style:background-color={topicColour(chip.topicId, 0.12)}
					data-topic-chip
				>
					<span
						class="size-2 rounded-full"
						style:background-color={topicColour(chip.topicId, 0.8)}
						aria-hidden="true"
					></span>
					{chip.name}
					<span class="text-muted-foreground tabular-nums" data-untaught>{chip.untaught}</span>
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
			fills={preview?.fills ?? current}
			{changing}
			{dragIds}
			ringed={moved?.lessonIds ?? []}
			{was}
			onGrip={dragStart}
			onRemove={(entry) => (removing = entry)}
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
				<li
					class="relative flex items-stretch {dragIds.includes(entry.lessonId)
						? 'opacity-40'
						: ''} {!dragging && moved?.lessonIds.includes(entry.lessonId)
						? 'ring-2 ring-amber-500 ring-inset'
						: ''}"
					style:background-color={topicColour(entry.topicId, 0.12)}
					data-drop={entry.fixed ? undefined : entry.lessonId}
				>
					{#if dragging && proposal && overId === entry.lessonId}
						<span
							class="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-primary {lineAbove
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
							class="flex w-7 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground"
							aria-label="Drag {entry.title}"
							onpointerdown={(event) => dragStart(event, entry.lessonId)}
						>
							<GripVerticalIcon class="size-4" />
						</button>
					{/if}
					<a
						href={resolve(`/lessons/${entry.lessonId}?class=${classId}`)}
						class="flex min-w-0 flex-1 flex-col gap-1 px-3 py-2 hover:bg-muted/40"
					>
						<span class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
							<span class="text-sm font-medium" data-title>{entry.title}</span>
							{#if entry.topicName}
								<span class="flex items-center gap-1.5 text-xs text-muted-foreground">
									<span
										class="size-2 rounded-full"
										style:background-color={topicColour(entry.topicId, 0.8)}
										aria-hidden="true"
									></span>
									{entry.topicName}
								</span>
							{/if}
							<span
								class="ml-auto flex items-center gap-2 text-xs text-muted-foreground tabular-nums"
							>
								{#if entry.ready}
									<span class="flex items-center gap-0.5" data-ready>
										<CheckIcon class="size-3" aria-hidden="true" />Ready
									</span>
								{/if}
								{#if entry.fixed}
									<LockIcon class="size-3" aria-label="Fixed: already taught" />
								{/if}
								{#if !dragging && was.has(entry.lessonId)}
									<span class="text-amber-700 dark:text-amber-400" data-was>
										was {was.get(entry.lessonId)
											? formatDateShort(was.get(entry.lessonId)!)
											: 'past the end'}
									</span>
								{/if}
								{entry.firstDate ? formatDateShort(entry.firstDate) : 'past the end'}
							</span>
						</span>
						{#if entry.note}
							<Markdown source={entry.note} class="line-clamp-2 text-xs text-muted-foreground" />
						{/if}
					</a>
					{#if !entry.fixed}
						<button
							type="button"
							class="flex items-center px-3 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
							aria-label={`Remove ${entry.title}`}
							onclick={() => (removing = entry)}
						>
							<XIcon class="size-4" aria-hidden="true" />
						</button>
					{/if}
				</li>
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

<Dialog.Root
	open={removing !== null}
	onOpenChange={(open) => {
		if (!open) removing = null;
	}}
>
	<Dialog.Content class="sm:max-w-md">
		{#if removing}
			<Dialog.Header>
				<Dialog.Title>Remove “{removing.title}” from this Class?</Dialog.Title>
				<Dialog.Description>
					{losses(removing)}
					{#if removing.onlyHere}
						“{removing.title}” is in no other Class. After you remove it, you cannot add it to a
						Class again.
					{/if}
				</Dialog.Description>
			</Dialog.Header>
			<Dialog.Footer>
				<Button variant="outline" size="sm" class="h-7" onclick={() => (removing = null)}>
					Cancel
				</Button>
				<form
					method="POST"
					action="?/removeLessons"
					use:enhance={() =>
						async ({ result, update }) => {
							removing = null;
							if (result.type === 'failure')
								toast.error(failureReason(result, 'Could not remove.'));
							else await update({ invalidateAll: true });
						}}
				>
					<input type="hidden" name="classId" value={classId} />
					<input type="hidden" name="lessonId" value={removing.lessonId} />
					<Button type="submit" variant="destructive" size="sm" class="h-7">Remove</Button>
				</form>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
