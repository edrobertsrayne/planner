<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { onFail, replaceQuery, submitForm } from '$lib/client/enhance';
	import { createSequenceBoard } from '$lib/client/sequence-board.svelte';
	import { lossSentence, type SequenceResult } from '$lib/sequence-text';
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

	let moveForm = $state<HTMLFormElement | undefined>();

	// The tab's board: the selection, the drag and its live layout preview, and the inline Add
	// Lesson field. Both layouts draw it; this file keeps the writes.
	const board = createSequenceBoard({
		entries: () => entries,
		weeks: () => weeks,
		result: () => sequenceResult,
		onDrop: (lessonIds, target) => {
			submitForm(moveForm, { fields: { lessonIds: lessonIds.join(','), targetId: target } });
		},
		onRemove: (gone) => (removing = gone)
	});
</script>

<svelte:window
	onpointermove={board.move}
	onpointerup={() => board.end(true)}
	onpointercancel={() => board.end(false)}
	onkeydown={(event) => {
		if (event.key !== 'Escape') return;
		if (board.dragging) board.end(false);
		else if (board.selectMode && !removing) board.endSelect();
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
				variant={board.selectMode ? 'default' : 'outline'}
				size="sm"
				class="h-7 text-xs"
				aria-pressed={board.selectMode}
				onclick={board.toggleSelect}
			>
				<ListChecksIcon data-icon="inline-start" />{board.selectMode ? 'Done' : 'Select'}
			</Button>
			<Button
				variant="outline"
				size="sm"
				class="h-7 text-xs"
				onclick={() => board.openAdd('tab', null)}
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
			use:enhance={onFail('Could not add the Lesson.', board.closeAdd)}
		>
			<input type="hidden" name="classId" value={classId} />
			<input type="hidden" name="afterLessonId" value={board.adding?.afterLessonId ?? ''} />
			<Input
				name="title"
				required
				autofocus
				placeholder="Lesson title"
				aria-label="Title of the new Lesson"
				class="h-7 max-w-xs text-xs"
				onkeydown={(event) => event.key === 'Escape' && board.closeAdd()}
			/>
			<Button type="submit" size="sm" class="h-7 text-xs">Add</Button>
			<Button type="button" variant="ghost" size="sm" class="h-7 text-xs" onclick={board.closeAdd}>
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

	{#if board.adding?.row === 'tab'}
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

	{#if board.refusal}
		<p class="mt-2 text-xs text-destructive" role="status" data-select-refusal>{board.refusal}</p>
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
						onclick={() => board.selectTopic(chip.topicId)}
					>
						Select
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	{#if byWeek}
		<SequenceWeeks {classId} {weeks} {freeAfter} {entries} {board} {addField} />
		{#if entries.length === 0}
			<p class="mt-3 text-sm text-muted-foreground">
				No Lessons in this Sequence yet. Use Assign Topic to add a Topic's Lessons.
			</p>
		{/if}
	{:else}
		<ol class="mt-3 divide-y rounded-xl border" data-sequence>
			{#each entries as entry (entry.lessonId)}
				<SequenceListRow {classId} {entry} {board} dropLine={board.dropLine(entry.lessonId)} />
			{:else}
				<li class="px-3 py-4 text-sm text-muted-foreground">
					No Lessons in this Sequence yet. Use Assign Topic to add a Topic's Lessons.
				</li>
			{/each}
		</ol>
	{/if}
</section>

{#if board.dragged}
	<div
		class="pointer-events-none fixed z-50 rounded-lg border bg-background px-2 py-1 text-xs font-medium shadow-lg"
		style:left="{board.ghost.x + 12}px"
		style:top="{board.ghost.y + 12}px"
	>
		{board.dragIds.length > 1
			? `${board.dragIds.length} Lessons, from “${board.dragged.title}”`
			: board.dragged.title}
	</div>
{/if}

{#if board.selectMode}
	<div
		class="fixed inset-x-0 bottom-6 z-40 mx-auto flex w-fit max-w-[95vw] flex-wrap items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm shadow-xl"
		role="toolbar"
		aria-label="Selection"
		data-select-bar
	>
		<span class="font-medium" data-select-count>
			{board.chosen.length ? `${board.chosen.length} selected` : 'Tap Lessons to select'}
		</span>
		<Button
			size="sm"
			variant="outline"
			class="text-destructive"
			disabled={board.chosen.length === 0}
			onclick={() => (removing = board.chosen)}
		>
			Remove
		</Button>
		<Button size="sm" onclick={board.endSelect}>Done</Button>
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
						board.forget(removing?.map((e) => e.lessonId) ?? []);
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
