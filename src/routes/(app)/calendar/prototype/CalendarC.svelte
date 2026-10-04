<!--
	PROTOTYPE ONLY (issue #312). Variant C, "The grid at every size". The week stays Periods against
	days on every screen; the tiles give way instead. On a phone a tile shows the Class only (the
	Lesson title comes back from `sm`), and a tap opens the Session page to read the rest. From `md`
	the tiles are today's, with the day menu in each day head.
-->
<script lang="ts">
	import { formatDayMonth } from '$lib/date';
	import DayMenu from './DayMenu.svelte';
	import DayPanel from './DayPanel.svelte';
	import Tile from './Tile.svelte';
	import WeekNav from './WeekNav.svelte';
	import { PERIODS, grid, weekDays, weekParam } from './store.svelte';

	const days = $derived(weekDays(weekParam()));
	const grids = $derived(days.map(grid));
</script>

<div class="mx-auto max-w-6xl px-2 py-4 sm:px-4 md:px-6 md:py-6">
	<div class="px-2 sm:px-0"><WeekNav /></div>

	<div
		class="mt-4 grid grid-cols-[1.5rem_repeat(5,minmax(0,1fr))] [grid-template-rows:auto_repeat(6,minmax(3.5rem,auto))] gap-1 md:grid-cols-[2.5rem_repeat(5,minmax(0,1fr))] md:[grid-template-rows:auto_repeat(6,minmax(4rem,auto))] md:gap-1.5"
	>
		<div></div>
		{#each days as d (d.date)}
			<div class="flex items-baseline gap-1 pb-1">
				<span class="text-xs font-semibold md:text-sm {d.isToday ? 'text-primary' : ''}"
					><span class="md:hidden">{d.name.slice(0, 1)}</span><span class="hidden md:inline"
						>{d.name}</span
					></span
				>
				<span class="text-[11px] text-muted-foreground tabular-nums md:text-xs"
					><span class="md:hidden">{Number(d.date.slice(8))}</span><span class="hidden md:inline"
						>{formatDayMonth(d.date)}</span
					></span
				>
				<span class="ml-auto hidden md:inline"><DayMenu day={d} /></span>
			</div>
		{/each}

		{#each PERIODS as p (p)}
			<div
				class="pt-1.5 text-right text-[11px] font-medium text-muted-foreground tabular-nums md:pr-1 md:text-xs"
				style:grid-row={p + 1}
				style:grid-column={1}
			>
				P{p}
			</div>
		{/each}

		{#each days as d, di (d.date)}
			{#if d.kind !== 'teaching'}
				<div style:grid-column={di + 2} style:grid-row="2 / span 6">
					<DayPanel day={d} class="h-full [writing-mode:vertical-rl] md:[writing-mode:initial]" />
				</div>
			{:else}
				{#each grids[di] as e, pi (pi)}
					{#if e.type === 'free'}
						<div
							class="rounded-lg bg-muted/40"
							style:grid-column={di + 2}
							style:grid-row={pi + 2}
						></div>
					{:else if e.type === 'start'}
						<div
							style:grid-column={di + 2}
							style:grid-row="{pi + 2} / span {e.cell.row.periodTo - e.cell.row.periodFrom + 1}"
						>
							<div class="h-full md:hidden"><Tile cell={e.cell} size="mini" /></div>
							<div class="hidden h-full md:block"><Tile cell={e.cell} /></div>
						</div>
					{/if}
				{/each}
			{/if}
		{/each}
	</div>
</div>
