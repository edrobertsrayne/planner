<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import CheckIcon from '@lucide/svelte/icons/check';
	import LockIcon from '@lucide/svelte/icons/lock';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { onFail, submitWithValue } from '$lib/client/enhance';
	import { formatDateShort } from '$lib/date';
	import Markdown from '$lib/components/markdown.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { topicColour } from '$lib/topic-colour';
	import type { SequenceEntry, SkipReason, TopicOption } from '$lib/server/planner';

	// What this Class teaches, in the order it teaches it: its own Sequence (ADR-0026). The list
	// layout only. Assign Topic adds a Topic's Lessons at the end; a tap on a card opens the Lesson
	// in its editor.
	let {
		classId,
		entries,
		topics,
		result
	}: {
		classId: string;
		entries: SequenceEntry[];
		topics: TopicOption[];
		result: {
			topicName: string;
			added: number;
			skipped: { title: string; reason: SkipReason }[];
		} | null;
	} = $props();

	let assignForm = $state<HTMLFormElement | undefined>();

	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
	const REASONS: Record<SkipReason, string> = {
		'in-sequence': 'already in this Sequence',
		placed: 'Placed on this Class'
	};
</script>

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
			<li class="flex items-stretch" style:background-color={topicColour(entry.topicId, 0.12)}>
				<a
					href={resolve(`/lessons/${entry.lessonId}?class=${classId}`)}
					class="flex min-w-0 flex-1 flex-col gap-1 px-3 py-2 hover:bg-muted/40"
				>
					<span class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
						<span class="text-sm font-medium">{entry.title}</span>
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
