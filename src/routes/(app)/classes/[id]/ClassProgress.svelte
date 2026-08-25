<script lang="ts">
	import { openSession } from '$lib/client/session-panel.svelte';
	import { formatDate } from '$lib/date';
	import type { ClassLane } from '$lib/server/planner';

	// How far this Class has got: the same lane the Classes view shows, read from the same
	// derived answer (issue #37). Last taught opens its Session — the note beneath it is what Ed
	// wrote there.
	let { classId, lane }: { classId: string; lane: ClassLane } = $props();

	const pct = $derived(lane.total ? Math.round((lane.taught / lane.total) * 100) : 0);
	const remaining = $derived(lane.runway.lessonsRemaining);
</script>

<div>
	<div class="flex items-baseline justify-between text-xs">
		<span class="text-muted-foreground">Through the plan</span>
		<span class="font-medium tabular-nums">{lane.taught} / {lane.total}</span>
	</div>
	<div class="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
		<div class="h-full bg-primary" style:width="{pct}%"></div>
	</div>

	<dl class="mt-3 space-y-1.5 text-xs">
		<div>
			<dt class="text-muted-foreground">Last taught</dt>
			<dd>
				{#if lane.lastTaught}
					{@const lt = lane.lastTaught}
					<button
						type="button"
						data-session-trigger
						class="text-left font-medium hover:underline"
						onclick={() => openSession({ classId, date: lt.date, period: lt.period })}
					>
						{lt.title}
					</button>
					{#if lt.note}<p class="mt-0.5 text-muted-foreground">{lt.note}</p>{/if}
				{:else}
					<span class="text-muted-foreground">Not taught yet.</span>
				{/if}
			</dd>
		</div>
		<div>
			<dt class="text-muted-foreground">Next up</dt>
			<dd class="font-medium">{lane.nextUp?.title ?? '—'}</dd>
		</div>
		<div>
			<dt class="text-muted-foreground">Runway</dt>
			<dd class="font-medium">
				{lane.runway.date ? formatDate(lane.runway.date) : 'open-ended'}
				{#if remaining > 0}
					<span class="font-normal text-muted-foreground">
						({remaining} Lesson{remaining === 1 ? '' : 's'} with no Slot left)
					</span>
				{/if}
			</dd>
		</div>
	</dl>
</div>
