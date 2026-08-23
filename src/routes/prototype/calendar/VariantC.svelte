<!--
	PROTOTYPE — throwaway. C — The day stacks.

	Rejects the grid's central assumption: that the Period axis has to be *ruled*. Roughly a third
	of this week's cells are free, and in a table those holes are paid for in height on every day
	at once. Here each day is a column that packs — only occasions render, each carrying its own
	Period in a gutter — so the sheet is as tall as the busiest day rather than as tall as the
	timetable.

	What that trades away is the horizontal read: "what am I doing period 3 all week" stops being a
	row you can scan. The claim is that a teacher never asks that, and asks "what does Tuesday look
	like" constantly. A gap marker keeps the free Periods visible without giving them a row.
-->
<script lang="ts">
	import BanIcon from '@lucide/svelte/icons/ban';
	import BlockPopover from './BlockPopover.svelte';
	import { skin, type ClassCue } from './tone.js';
	import {
		BLOCKED_DAY_INDEX,
		BLOCKED_DAY_LABEL,
		DAY_NAMES,
		PERIODS,
		addDays,
		fmtDay,
		toGrid,
		type Cell,
		type GridEntry,
		type Week
	} from './fixtures.js';

	let { weeks, cue }: { weeks: Week[]; cue: ClassCue } = $props();

	type Run = { type: 'cell'; cell: Cell } | { type: 'gap'; periods: number[] };

	/** A day column as a flat run: the cells that start there, with free Periods collapsed to gaps. */
	function stack(grid: GridEntry[][], di: number): Run[] {
		const out: Run[] = [];
		for (const period of PERIODS) {
			const entry = grid[di][period - 1];
			if (entry.type === 'covered') continue;
			if (entry.type === 'free') {
				const last = out.at(-1);
				if (last?.type === 'gap') last.periods.push(period);
				else out.push({ type: 'gap', periods: [period] });
			} else {
				out.push({ type: 'cell', cell: entry.cell });
			}
		}
		return out;
	}
</script>

{#each weeks as week (week.letter)}
	{@const grid = toGrid(week.cells)}
	{#if weeks.length > 1}
		<h2 class="pt-4 pb-1 text-sm font-semibold first:pt-0">
			Week {week.letter}
			<span class="font-normal text-muted-foreground">w/c {fmtDay(week.monday)}</span>
		</h2>
	{/if}

	<div class="grid grid-cols-5 gap-2 overflow-x-auto">
		{#each DAY_NAMES as d, di (d)}
			{@const dayBlocked = week.letter === 'A' && di === BLOCKED_DAY_INDEX}
			<section class="flex min-w-36 flex-col rounded-md border bg-card">
				<header class="flex items-baseline gap-1.5 border-b px-2 py-1.5">
					<span class="text-sm font-semibold">{d}</span>
					<span class="text-xs text-muted-foreground">{fmtDay(addDays(week.monday, di))}</span>
					{#if dayBlocked}
						<span
							class="ml-auto rounded-2xl bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
						>
							{BLOCKED_DAY_LABEL}
						</span>
					{:else}
						<BlockPopover
							scope="day"
							subject={`${d} ${fmtDay(addDays(week.monday, di))}`}
							triggerClass="ml-auto rounded px-1 text-xs text-muted-foreground/50 hover:text-foreground focus-visible:text-foreground"
						>
							{#snippet trigger()}Block day{/snippet}
						</BlockPopover>
					{/if}
				</header>

				<div class="flex flex-col gap-1 p-1 {dayBlocked ? 'hatched' : ''}">
					{#each stack(grid, di) as item, i (i)}
						{#if item.type === 'gap'}
							<div
								class="px-2 py-1 text-xs text-muted-foreground/60 tabular-nums"
								aria-label="Free"
							>
								{item.periods.length === 1
									? `P${item.periods[0]}`
									: `P${item.periods[0]}–${item.periods.at(-1)}`} free
							</div>
						{:else}
							{@const cell = item.cell}
							{@const span = cell.periodTo - cell.periodFrom + 1}
							{@const s = skin(cell.tone, cue)}
							<div class="group/cell relative">
								{#if cell.kind === 'blocked'}
									<div
										class="hatched flex flex-col rounded-md border border-dashed px-2 py-1.5 text-xs"
									>
										<span class="text-muted-foreground tabular-nums">
											P{cell.periodFrom}{span > 1 ? `–${cell.periodTo}` : ''}
										</span>
										<span class="font-medium text-muted-foreground">{cell.classLabel}</span>
										<span class="text-muted-foreground/80 italic">
											{cell.blockedNote ?? BLOCKED_DAY_LABEL}
										</span>
									</div>
								{:else}
									<button
										type="button"
										data-session-trigger
										class="relative flex w-full flex-col overflow-hidden rounded-md border px-2 py-1.5 text-left text-xs hover:bg-foreground/5"
										style:background-color={s.surface}
										style:border-color={s.edge}
									>
										{#if s.stripe}
											<span
												class="absolute inset-y-0 left-0 w-1"
												style:background-color={s.stripe}
												aria-hidden="true"
											></span>
										{/if}

										<span class="flex items-baseline gap-1.5 {s.stripe ? 'pl-1.5' : ''}">
											<span class="text-muted-foreground tabular-nums">
												P{cell.periodFrom}{span > 1 ? `–${cell.periodTo}` : ''}
											</span>
										</span>

										<span class="mt-0.5 flex items-baseline gap-1.5 {s.stripe ? 'pl-1.5' : ''}">
											{#if s.chipBg}
												<span
													class="rounded-2xl px-1.5 font-medium"
													style:background-color={s.chipBg}
													style:color={s.chipFg}>{cell.classLabel}</span
												>
											{:else}
												<span class="font-semibold" style:color={s.labelFg}>{cell.classLabel}</span>
											{/if}
										</span>

										{#if cell.lesson}
											<span class="mt-0.5 line-clamp-3 leading-tight {s.stripe ? 'pl-1.5' : ''}">
												{cell.lesson.title}
											</span>
										{:else}
											<span class="mt-0.5 text-muted-foreground italic {s.stripe ? 'pl-1.5' : ''}">
												Unplanned
											</span>
										{/if}
									</button>

									{#if cell.periodFrom === cell.periodTo}
										<BlockPopover
											scope="slot"
											subject={`${cell.classLabel}, P${cell.periodFrom}`}
											triggerClass="absolute top-1 right-1 rounded p-0.5 text-muted-foreground opacity-0 group-hover/cell:opacity-100 focus-visible:opacity-100 hover:bg-background/70"
										>
											{#snippet trigger()}<BanIcon class="size-3" />{/snippet}
										</BlockPopover>
									{/if}
								{/if}
							</div>
						{/if}
					{/each}
				</div>
			</section>
		{/each}
	</div>
{/each}
