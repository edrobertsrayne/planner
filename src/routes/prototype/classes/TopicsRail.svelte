<!--
	PROTOTYPE — throwaway. Assigned Topics treatment 3 — "the rail".
	Narrow, for the right column: position, name, and a single stacked reorder control that reads as
	one affordance rather than three icons. Everything else is dropped — the counts live on the lane
	strip. Argues Topics is a short ordered list you nudge, not a table.
-->
<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import XIcon from '@lucide/svelte/icons/x';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { ASSIGNED_TOPICS, COURSE_TOPICS } from './fixtures';
</script>

<ul class="divide-y rounded-lg border">
	{#each ASSIGNED_TOPICS as a, i (a.id)}
		<li class="group flex items-stretch gap-2 py-1 pr-1 pl-3">
			<span class="self-center text-xs text-muted-foreground tabular-nums">{i + 1}</span>
			<span class="min-w-0 flex-1 self-center truncate text-sm">{a.topicName}</span>
			<div class="flex flex-col justify-center opacity-0 group-hover:opacity-100">
				<button
					type="button"
					disabled={i === 0}
					aria-label="Move {a.topicName} earlier"
					class="rounded-t-sm px-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20"
				>
					<ChevronUpIcon class="size-3" />
				</button>
				<button
					type="button"
					disabled={i === ASSIGNED_TOPICS.length - 1}
					aria-label="Move {a.topicName} later"
					class="rounded-b-sm px-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20"
				>
					<ChevronDownIcon class="size-3" />
				</button>
			</div>
			<Button
				variant="ghost"
				size="icon-xs"
				class="self-center opacity-0 group-hover:opacity-100"
				aria-label="Unassign {a.topicName}"
			>
				<XIcon />
			</Button>
		</li>
	{/each}

	<li class="p-1">
		<Select.Root type="single">
			<Select.Trigger size="sm" class="w-full justify-start border-0 bg-transparent">
				<PlusIcon class="size-3.5 text-muted-foreground" />
				<span class="text-muted-foreground">Assign next Topic</span>
			</Select.Trigger>
			<Select.Content>
				{#each COURSE_TOPICS as t (t.id)}
					<Select.Item value={t.id} label={t.name} />
				{/each}
			</Select.Content>
		</Select.Root>
	</li>
</ul>
