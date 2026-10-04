<!--
	PROTOTYPE ONLY (issue #312). Variant D, "Swipe through the days". The week stays one grid with
	full tiles, but a day never gets narrower than a readable column. Where five do not fit, the
	grid scrolls sideways and snaps to a day, with the Period numbers held at the left. A phone
	shows about two days, a tablet about four; a laptop shows all five, as today. The grid opens
	scrolled to today. The day menu shows from `md`.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { formatDayMonth } from '$lib/date';
	import DayMenu from './DayMenu.svelte';
	import DayPanel from './DayPanel.svelte';
	import Tile from './Tile.svelte';
	import WeekNav from './WeekNav.svelte';
	import { PERIODS, grid, weekDays, weekParam } from './store.svelte';

	const days = $derived(weekDays(weekParam()));
	const grids = $derived(days.map(grid));

	let scroller = $state<HTMLDivElement>();
	onMount(async () => {
		await tick();
		const col = scroller?.querySelector<HTMLElement>('[data-today]');
		if (scroller && col) scroller.scrollLeft = col.offsetLeft - 32;
	});
</script>

<div class="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-6">
	<WeekNav />

	<div
		bind:this={scroller}
		class="-mx-4 mt-4 snap-x snap-mandatory scroll-pl-8 overflow-x-auto pb-2 md:mx-0 md:scroll-pl-10"
	>
		<div
			class="grid grid-cols-[2rem_repeat(5,minmax(10rem,1fr))] [grid-template-rows:auto_repeat(6,minmax(4rem,auto))] gap-1.5 pr-4 md:grid-cols-[2.5rem_repeat(5,minmax(10rem,1fr))] md:pr-0"
		>
			<div class="sticky left-0 z-10 bg-background"></div>
			{#each days as d (d.date)}
				<div
					class="flex snap-start items-baseline gap-1.5 pb-1"
					data-today={d.isToday ? '' : undefined}
				>
					<span class="text-sm font-semibold {d.isToday ? 'text-primary' : ''}">{d.name}</span>
					<span class="text-xs text-muted-foreground">{formatDayMonth(d.date)}</span>
					<span class="ml-auto hidden md:inline"><DayMenu day={d} /></span>
				</div>
			{/each}

			{#each PERIODS as p (p)}
				<div
					class="sticky left-0 z-10 bg-background pt-1.5 pr-1 text-right text-xs font-medium text-muted-foreground tabular-nums"
					style:grid-row={p + 1}
					style:grid-column={1}
				>
					P{p}
				</div>
			{/each}

			{#each days as d, di (d.date)}
				{#if d.kind !== 'teaching'}
					<div style:grid-column={di + 2} style:grid-row="2 / span 6">
						<DayPanel day={d} class="h-full" />
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
								<Tile cell={e.cell} />
							</div>
						{/if}
					{/each}
				{/if}
			{/each}
		</div>
	</div>
</div>
