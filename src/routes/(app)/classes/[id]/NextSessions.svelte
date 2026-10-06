<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { sessionHref } from '$lib/client/session-href';
	import { formatShortWeekday } from '$lib/date';
	import { touchTarget } from '$lib/components/ui/touch-target';
	import type { AgendaEntry } from '$lib/server/planner';

	let { rows }: { rows: AgendaEntry[] } = $props();
</script>

<section>
	<h2 class="mb-2 text-sm font-semibold">Next Sessions</h2>
	<ul class="divide-y divide-border overflow-hidden rounded-xl border">
		{#each rows as r (r.date + r.periodFrom)}
			<li>
				<a
					href={sessionHref({ classId: r.classId, date: r.date, period: r.periodFrom })}
					class="flex min-h-11 items-center gap-3 px-3 py-2 hover:bg-muted/40 {touchTarget} md:min-h-10"
				>
					<span class="w-24 shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
						{formatShortWeekday(r.date)} P{r.periodFrom}{#if r.periodTo !== r.periodFrom}&ndash;P{r.periodTo}{/if}
					</span>
					<!-- A title wraps in full, never truncates (issue #316). -->
					<span
						class="min-w-0 flex-1 text-sm {r.lesson
							? 'font-medium'
							: 'text-muted-foreground italic'}"
					>
						{r.lesson?.title ?? 'Open Slot'}
					</span>
					<ChevronRightIcon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
				</a>
			</li>
		{/each}
	</ul>
</section>
