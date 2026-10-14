<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import CheckIcon from '@lucide/svelte/icons/check';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import LockIcon from '@lucide/svelte/icons/lock';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { onFail, submitWithValue } from '$lib/client/enhance';
	import { movedOrder } from '$lib/sequence-order';
	import { formatDateShort } from '$lib/date';
	import Markdown from '$lib/components/markdown.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { topicColour } from '$lib/topic-colour';
	import type { DateChange, SequenceEntry, SkipReason, TopicOption } from '$lib/server/planner';

	// What this Class teaches, in the order it teaches it: its own Sequence (ADR-0026). The list
	// layout only. Assign Topic adds a Topic's Lessons at the end; a tap on a card opens the Lesson
	// in its editor; a drag from the grip moves the Lesson onto another Lesson's place.
	let {
		classId,
		entries,
		topics,
		result,
		moved
	}: {
		classId: string;
		entries: SequenceEntry[];
		topics: TopicOption[];
		result: {
			topicName: string;
			added: number;
			skipped: { title: string; reason: SkipReason }[];
		} | null;
		// The last Move: the Lessons moved, and each Lesson that got a new first Slot.
		moved: { lessonIds: string[]; changed: DateChange[]; lessonsChanged: number } | null;
	} = $props();

	let assignForm = $state<HTMLFormElement | undefined>();
	let moveForm = $state<HTMLFormElement | undefined>();

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
		<form
			method="POST"
			action="?/assignTopic"
			class="ml-auto max-md:hidden"
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
			</li>
		{:else}
			<li class="px-3 py-4 text-sm text-muted-foreground">
				No Lessons in this Sequence yet. Use Assign Topic to add a Topic's Lessons.
			</li>
		{/each}
	</ol>
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
