<!--
	PROTOTYPE ONLY (issue #312). Variant B, "The week as a list". From `lg` (laptop): today's grid.
	Below `lg`: the five days stacked, each with its Sessions in Period order. Free Periods are left
	out; the Period numbers show the gaps. On a tablet (`md`–`lg`) the days sit as cards in two
	columns, each with its day menu. On a phone they are one column, with no day menu, and the page
	scrolls to today.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { formatWeekday } from '$lib/date';
	import DayMenu from './DayMenu.svelte';
	import DayPanel from './DayPanel.svelte';
	import Tile from './Tile.svelte';
	import WeekGrid from './WeekGrid.svelte';
	import WeekNav from './WeekNav.svelte';
	import { weekDays, weekParam } from './store.svelte';

	const days = $derived(weekDays(weekParam()));

	onMount(async () => {
		await tick();
		if (window.innerWidth < 768)
			document.getElementById('cal-b-today')?.scrollIntoView({ block: 'start' });
	});
</script>

<div class="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-6">
	<WeekNav />

	<div class="mt-4 hidden lg:block"><WeekGrid {days} /></div>

	<div class="mt-4 grid gap-6 md:grid-cols-2 md:gap-4 lg:hidden">
		{#each days as d (d.date)}
			<section
				id={d.isToday ? 'cal-b-today' : undefined}
				class="min-w-0 scroll-mt-[calc(var(--shell-top)+0.5rem)] md:rounded-xl md:border md:bg-card md:p-3"
			>
				<div class="flex items-center gap-2">
					<h2 class="text-sm font-semibold">{formatWeekday(d.date)}</h2>
					{#if d.isToday}
						<span
							class="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground"
							>Today</span
						>
					{/if}
					<span class="ml-auto hidden md:inline"><DayMenu day={d} class="h-8" /></span>
				</div>
				{#if d.kind !== 'teaching'}
					<DayPanel day={d} class="mt-2 h-20" />
				{:else if d.cells.length === 0}
					<p class="mt-2 text-xs text-muted-foreground">No Sessions.</p>
				{:else}
					<ol class="mt-2 space-y-1.5">
						{#each d.cells as c (c.row.key)}
							<li class="flex items-stretch gap-3">
								<span
									class="w-6 shrink-0 pt-3 text-xs font-medium text-muted-foreground tabular-nums"
									>P{c.row.periodFrom}</span
								>
								<Tile cell={c} size="row" class="flex-1" />
							</li>
						{/each}
					</ol>
				{/if}
			</section>
		{/each}
	</div>
</div>
