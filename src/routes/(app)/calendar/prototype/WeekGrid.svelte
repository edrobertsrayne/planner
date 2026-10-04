<!--
	PROTOTYPE ONLY (issue #312). Today's laptop grid: Periods against days, a day menu in each day
	head, a multi-Period Lesson as one tall tile, a day with no teaching as one panel. Variants A
	and B use it unchanged where it fits.
-->
<script lang="ts">
	import { formatDayMonth } from '$lib/date';
	import DayMenu from './DayMenu.svelte';
	import DayPanel from './DayPanel.svelte';
	import Tile from './Tile.svelte';
	import { PERIODS, grid, type Day } from './store.svelte';

	let { days }: { days: Day[] } = $props();
	const grids = $derived(days.map(grid));
</script>

<table class="w-full table-fixed border-separate border-spacing-1.5">
	<thead>
		<tr>
			<th class="w-10"></th>
			{#each days as day (day.date)}
				<th class="pb-1 text-left align-bottom">
					<div class="flex items-baseline gap-1.5">
						<span class="text-sm font-semibold {day.isToday ? 'text-primary' : ''}">{day.name}</span
						>
						<span class="text-xs font-normal text-muted-foreground">{formatDayMonth(day.date)}</span
						>
						<DayMenu {day} class="ml-auto" />
					</div>
				</th>
			{/each}
		</tr>
	</thead>
	<tbody>
		{#each PERIODS as period (period)}
			<tr>
				<th class="pr-1 text-right align-top">
					<div class="pt-1.5 text-xs font-medium text-muted-foreground tabular-nums">P{period}</div>
				</th>
				{#each days as day, di (day.date)}
					{#if day.kind !== 'teaching'}
						{#if period === 1}
							<td rowspan={PERIODS.length} class="h-16"><DayPanel {day} class="h-full" /></td>
						{/if}
					{:else}
						{@const e = grids[di][period - 1]}
						{#if e.type === 'free'}
							<td class="h-16 rounded-lg bg-muted/40"></td>
						{:else if e.type === 'start'}
							<td rowspan={e.cell.row.periodTo - e.cell.row.periodFrom + 1} class="h-16 align-top">
								<Tile cell={e.cell} />
							</td>
						{/if}
					{/if}
				{/each}
			</tr>
		{/each}
	</tbody>
</table>
