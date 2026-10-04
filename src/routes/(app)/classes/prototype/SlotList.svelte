<!--
	PROTOTYPE ONLY (issue #313). The Class's Timetable as a read-only list: one line per day, the
	Periods it teaches in Week A and Week B. For a phone, where the grid is not written.
-->
<script lang="ts">
	import { DAYS, WEEKS, slotsOf, type Klass } from './store.svelte';

	let { klass }: { klass: Klass } = $props();
	const periods = (week: (typeof WEEKS)[number], day: number) =>
		slotsOf(klass.id, week)
			.filter((s) => s.day === day)
			.map((s) => s.period)
			.sort();
</script>

<table class="w-full text-sm">
	<thead>
		<tr class="text-xs text-muted-foreground">
			<th class="w-12 py-1 text-left font-medium"></th>
			{#each WEEKS as w (w)}<th class="py-1 text-left font-medium">Week {w}</th>{/each}
		</tr>
	</thead>
	<tbody class="divide-y">
		{#each DAYS as d, i (d)}
			<tr>
				<th class="py-2 text-left text-xs font-medium text-muted-foreground">{d}</th>
				{#each WEEKS as w (w)}
					{@const ps = periods(w, i + 1)}
					<td class="py-2 tabular-nums">
						{#if ps.length}{ps.map((p) => `P${p}`).join(', ')}{:else}<span
								class="text-muted-foreground/50">—</span
							>{/if}
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>
