<!--
	PROTOTYPE — throwaway. Assigned Topics treatment 1 — "the ordered grid".
	Today's shape restyled: two columns of rows, each with its position, up/down and unassign, and a
	Select at the foot to add the next one. Reordering is button-driven and always visible.
-->
<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import XIcon from '@lucide/svelte/icons/x';
	import { ASSIGNED_TOPICS, COURSE_TOPICS } from './fixtures';
</script>

<ul class="grid gap-2 sm:grid-cols-2">
	{#each ASSIGNED_TOPICS as a, i (a.id)}
		<li class="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
			<span class="w-4 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
				{i + 1}
			</span>
			<span class="min-w-0 flex-1 truncate text-sm">{a.topicName}</span>
			<span class="shrink-0 text-xs text-muted-foreground tabular-nums">
				{a.taught}/{a.lessons}
			</span>
			<div class="flex shrink-0">
				<Button variant="ghost" size="icon-xs" disabled={i === 0} aria-label="Move earlier">
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
			</div>
		</li>
	{/each}
</ul>

<div class="mt-3 flex items-center gap-2">
	<Select.Root type="single">
		<Select.Trigger size="sm" class="w-64">Pick a Topic…</Select.Trigger>
		<Select.Content>
			{#each COURSE_TOPICS as t (t.id)}
				<Select.Item value={t.id} label={t.name} />
			{/each}
		</Select.Content>
	</Select.Root>
	<Button size="sm">Assign next</Button>
</div>
