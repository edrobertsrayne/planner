<!--
	PROTOTYPE ONLY (issue #313). The Class's next five Sessions, each opening the Session page
	(issue #311). An Open Slot reads as such.
-->
<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { formatShortWeekday } from '$lib/date';
	import { lane, sessionHref, type Klass } from './store.svelte';

	let { klass }: { klass: Klass } = $props();
</script>

<section>
	<h2 class="mb-2 text-sm font-semibold">Next Sessions</h2>
	<ul class="divide-y rounded-xl border">
		{#each lane(klass).upcoming as r (r.key)}
			<li>
				<a
					href={sessionHref(r)}
					class="flex min-h-12 items-center gap-3 px-3 py-2 hover:bg-muted/40 md:min-h-10"
				>
					<span class="w-24 shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
						{formatShortWeekday(r.date)} P{r.periodFrom}
					</span>
					<span
						class="min-w-0 flex-1 truncate text-sm {r.lesson ? '' : 'text-muted-foreground italic'}"
					>
						{r.lesson?.title ?? 'Open Slot'}
					</span>
					<ChevronRightIcon class="size-4 text-muted-foreground" />
				</a>
			</li>
		{/each}
	</ul>
</section>
