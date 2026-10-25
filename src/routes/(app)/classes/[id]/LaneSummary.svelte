<script lang="ts">
	import { sessionHref } from '$lib/client/session-href';
	import Markdown from '$lib/components/markdown.svelte';
	import { formatDate } from '$lib/date';
	import type { ClassLane } from '$lib/server/planner';

	// Last taught, Next up and the Runway: the same lane the Classes view shows, read from the same
	// derived answer (issue #37). Last taught opens its Session — the note beneath it is what Ed
	// wrote there.
	let { classId, lane }: { classId: string; lane: ClassLane } = $props();

	const remaining = $derived(lane.runway.lessonsRemaining);
</script>

<div>
	<dl class="space-y-1.5 text-xs">
		<div>
			<dt class="text-muted-foreground">Last taught</dt>
			<dd>
				{#if lane.lastTaught}
					{@const lt = lane.lastTaught}
					<a
						href={sessionHref({ classId, date: lt.date, period: lt.period })}
						class="text-left font-medium hover:underline"
					>
						{lt.title}
					</a>
					{#if lt.note}<Markdown
							source={lt.note}
							class="mt-0.5 text-xs text-muted-foreground"
						/>{/if}
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
			{#if remaining > 0}
				<dd class="font-medium text-destructive">
					{remaining} Lesson{remaining === 1 ? '' : 's'} past the end of the year
				</dd>
			{:else}
				<dd class="font-medium">
					{lane.runway.date ? formatDate(lane.runway.date) : 'open-ended'}
				</dd>
			{/if}
		</div>
	</dl>
</div>
