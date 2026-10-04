<!--
	PROTOTYPE ONLY (issue #312). Variant A, "One day at a time". From `md` (tablet and laptop): today's
	grid. Below `md`: a row of five day buttons, then the chosen day's six Periods as a list, with a
	free Period shown as a gap. The day opens on today, else Monday. No day menu on a phone.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { addDays, formatWeekday } from '$lib/date';
	import DayPanel from './DayPanel.svelte';
	import Tile from './Tile.svelte';
	import WeekGrid from './WeekGrid.svelte';
	import WeekNav from './WeekNav.svelte';
	import { PERIODS, grid, set, weekDays, weekParam } from './store.svelte';

	const week = $derived(weekParam());
	const days = $derived(weekDays(week));
	const dayParam = $derived(page.url.searchParams.get('day'));
	const chosen = $derived(
		days.find((d) => d.date === dayParam) ?? days.find((d) => d.isToday) ?? days[0]
	);
	const entries = $derived(grid(chosen));
</script>

<div class="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-6">
	<WeekNav />

	<div class="mt-4 hidden md:block"><WeekGrid {days} /></div>

	<div class="md:hidden">
		<div
			class="sticky top-[var(--shell-top)] z-10 -mx-4 mt-3 grid grid-cols-5 gap-1 border-b bg-background px-4 py-2"
			role="tablist"
			aria-label="Day"
		>
			{#each days as d (d.date)}
				{@const on = d.date === chosen.date}
				<button
					type="button"
					role="tab"
					aria-selected={on}
					class="flex h-14 flex-col items-center justify-center rounded-lg text-xs {on
						? 'bg-primary text-primary-foreground'
						: d.kind === 'teaching'
							? 'hover:bg-muted'
							: 'text-muted-foreground/60'}"
					onclick={() => set({ day: d.date })}
				>
					<span class="font-medium">{d.name}</span>
					<span class="text-base font-semibold tabular-nums">{Number(d.date.slice(8))}</span>
					{#if d.isToday && !on}<span class="size-1 rounded-full bg-primary"></span>{/if}
				</button>
			{/each}
		</div>

		<h2 class="mt-4 text-sm font-semibold">{formatWeekday(chosen.date)}</h2>
		{#if chosen.kind !== 'teaching'}
			<DayPanel day={chosen} class="mt-3 h-40" />
		{:else}
			<ol class="mt-3 space-y-1.5">
				{#each PERIODS as p (p)}
					{@const e = entries[p - 1]}
					{#if e.type !== 'covered'}
						<li class="flex items-stretch gap-3">
							<span class="w-6 shrink-0 pt-3 text-xs font-medium text-muted-foreground tabular-nums"
								>P{p}</span
							>
							{#if e.type === 'start'}
								<Tile cell={e.cell} size="row" class="flex-1" />
							{:else}
								<div
									class="flex min-h-11 flex-1 items-center rounded-lg bg-muted/40 px-3 text-xs text-muted-foreground"
								>
									Free
								</div>
							{/if}
						</li>
					{/if}
				{/each}
			</ol>
		{/if}
		<div class="mt-6 flex justify-between text-sm">
			{#if chosen !== days[0]}
				<button
					type="button"
					class="h-11 rounded-md px-3 text-muted-foreground hover:bg-muted"
					onclick={() => set({ day: addDays(chosen.date, -1) })}>← Previous day</button
				>
			{:else}<span></span>{/if}
			{#if chosen !== days[4]}
				<button
					type="button"
					class="h-11 rounded-md px-3 text-muted-foreground hover:bg-muted"
					onclick={() => set({ day: addDays(chosen.date, 1) })}>Next day →</button
				>
			{/if}
		</div>
	</div>
</div>
