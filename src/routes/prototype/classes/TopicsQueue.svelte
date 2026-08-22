<!--
	PROTOTYPE — throwaway. Assigned Topics treatment 2 — "the queue".
	One column, read as a queue with a waterline: what is finished, what is being taught now, what
	is still to come. Argues the order only matters ahead of the waterline, so reorder controls
	appear on hover and only on the Topics that can still move. The Runway lands at the bottom of
	the queue, where the plan actually runs out.
-->
<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import XIcon from '@lucide/svelte/icons/x';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { ASSIGNED_TOPICS, COURSE_TOPICS, SUBJECT, fmtLong } from './fixtures';

	const current = ASSIGNED_TOPICS.findIndex((a) => a.taught > 0 && a.taught < a.lessons);
</script>

<ol class="max-w-xl">
	{#each ASSIGNED_TOPICS as a, i (a.id)}
		{@const done = a.taught === a.lessons}
		{@const isCurrent = i === current}
		{@const movable = i > current}
		<li
			class="group flex items-center gap-3 border-l-2 py-2 pl-3 {isCurrent
				? 'border-primary'
				: done
					? 'border-border'
					: 'border-dashed border-border'}"
		>
			<span
				class="flex size-5 shrink-0 items-center justify-center rounded-full text-[0.625rem] tabular-nums {done
					? 'bg-muted text-muted-foreground'
					: isCurrent
						? 'bg-primary text-primary-foreground'
						: 'border text-muted-foreground'}"
			>
				{#if done}<CheckIcon class="size-3" />{:else}{i + 1}{/if}
			</span>

			<span class="min-w-0 flex-1 truncate text-sm {done ? 'text-muted-foreground' : ''}">
				{a.topicName}
			</span>

			<span class="shrink-0 text-xs text-muted-foreground tabular-nums">
				{#if done}
					{a.lessons} Lessons
				{:else if isCurrent}
					{a.taught} of {a.lessons} taught
				{:else}
					{a.lessons} Lessons
				{/if}
			</span>

			<div class="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
				{#if movable}
					<Button
						variant="ghost"
						size="icon-xs"
						disabled={i === current + 1}
						aria-label="Move earlier"
					>
						<ArrowUpIcon />
					</Button>
					<Button
						variant="ghost"
						size="icon-xs"
						disabled={i === ASSIGNED_TOPICS.length - 1}
						aria-label="Move later"
					>
						<ArrowDownIcon />
					</Button>
					<Button variant="ghost" size="icon-xs" aria-label="Unassign {a.topicName}">
						<XIcon />
					</Button>
				{/if}
			</div>
		</li>
	{/each}

	<li class="flex items-center gap-3 border-l-2 border-dashed py-2 pl-3">
		<span class="size-5 shrink-0"></span>
		<span class="text-xs text-muted-foreground">
			Runway ends {SUBJECT.runway.date ? fmtLong(SUBJECT.runway.date) : 'open-ended'} — assign another
			Topic before then.
		</span>
	</li>
</ol>

<div class="mt-3 flex max-w-xl items-center gap-2">
	<Select.Root type="single">
		<Select.Trigger size="sm" class="flex-1">Add the next Topic…</Select.Trigger>
		<Select.Content>
			{#each COURSE_TOPICS as t (t.id)}
				<Select.Item value={t.id} label={t.name} />
			{/each}
		</Select.Content>
	</Select.Root>
	<Button size="sm">Assign</Button>
</div>
