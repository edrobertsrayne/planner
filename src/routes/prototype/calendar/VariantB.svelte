<!--
	PROTOTYPE — throwaway. B — The timetable.

	The opposite bet to A. A school timetable is a *ruled sheet*, not a board of cards: cells are
	flush, the rules do the separating, and every cell is one line of text. Dropping the tile buys
	roughly half the height back, which is what makes both halves of the Teaching Week fit on one
	screen — so B shows the fortnight as one continuous sheet with a Week A / Week B band, rather
	than paging between two weeks.

	The claim under test is that the Calendar is for *finding* a Session, not reading one — the
	Agenda (#68) already reads them — so a truncated title is not a loss.
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
		PERIOD_TIMES,
		addDays,
		fmtDay,
		toGrid,
		type Week
	} from './fixtures.js';

	let { weeks, cue }: { weeks: Week[]; cue: ClassCue } = $props();
</script>

<div class="overflow-x-auto rounded-md border">
	<!-- `table-fixed` is load-bearing: it is what makes the five day columns equal and lets a long
	     Lesson title truncate instead of widening its column and pushing Friday off the screen. -->
	<table class="w-full table-fixed border-collapse text-xs">
		{#each weeks as week (week.letter)}
			{@const grid = toGrid(week.cells)}
			<thead>
				<tr class="border-b bg-muted/60">
					<th class="w-14 px-2 py-1 text-left font-semibold">
						{#if weeks.length > 1}Week {week.letter}{/if}
					</th>
					{#each DAY_NAMES as d, di (d)}
						{@const blocked = week.letter === 'A' && di === BLOCKED_DAY_INDEX}
						<th class="border-l px-2 py-1 text-left font-semibold">
							<span class="flex items-baseline gap-1.5 truncate">
								{d}
								<span class="font-normal text-muted-foreground">
									{fmtDay(addDays(week.monday, di))}
								</span>
								{#if blocked}
									<span class="ml-auto font-medium text-muted-foreground">{BLOCKED_DAY_LABEL}</span>
								{:else}
									<BlockPopover
										scope="day"
										subject={`${d} ${fmtDay(addDays(week.monday, di))}`}
										triggerClass="ml-auto font-normal text-muted-foreground/50 hover:text-foreground focus-visible:text-foreground"
									>
										{#snippet trigger()}Block{/snippet}
									</BlockPopover>
								{/if}
							</span>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each PERIODS as period (period)}
					<tr class="border-b last:border-b-0">
						<th class="border-r bg-muted/30 px-2 py-1 text-left align-middle font-medium">
							<span class="tabular-nums">P{period}</span>
							<span class="block font-normal text-muted-foreground/80">{PERIOD_TIMES[period]}</span>
						</th>

						{#each DAY_NAMES as d, di (d)}
							{@const entry = grid[di][period - 1]}
							{#if entry.type === 'covered'}
								<!-- covered by an earlier Period's rowspan -->
							{:else if entry.type === 'free'}
								<td class="border-l"></td>
							{:else}
								{@const cell = entry.cell}
								{@const span = cell.periodTo - cell.periodFrom + 1}
								{@const s = skin(cell.tone, cue)}
								<td
									rowspan={span}
									class="group/cell relative border-l p-0 align-middle {cell.kind === 'blocked'
										? 'hatched'
										: ''}"
									style:background-color={cell.kind === 'blocked' ? undefined : s.surface}
								>
									{#if s.stripe && cell.kind !== 'blocked'}
										<span
											class="absolute inset-y-0 left-0 w-1"
											style:background-color={s.stripe}
											aria-hidden="true"
										></span>
									{/if}

									{#if cell.kind === 'blocked'}
										<div class="flex items-baseline gap-1.5 px-2 py-1">
											<span class="font-medium text-muted-foreground">{cell.classLabel}</span>
											<span class="truncate text-muted-foreground/80 italic">
												{cell.blockedNote ?? BLOCKED_DAY_LABEL}
											</span>
										</div>
									{:else}
										<button
											type="button"
											data-session-trigger
											class="flex h-full w-full items-baseline gap-1.5 px-2 py-1 text-left hover:bg-foreground/5 {s.stripe
												? 'pl-3'
												: ''}"
										>
											{#if s.chipBg}
												<span
													class="shrink-0 rounded-2xl px-1.5 font-medium"
													style:background-color={s.chipBg}
													style:color={s.chipFg}>{cell.classLabel}</span
												>
											{:else}
												<span class="shrink-0 font-semibold" style:color={s.labelFg}>
													{cell.classLabel}
												</span>
											{/if}

											{#if cell.lesson}
												<span class="min-w-0 truncate">{cell.lesson.title}</span>
											{:else}
												<span class="text-muted-foreground italic">Unplanned</span>
											{/if}

											{#if span > 1}
												<span class="ml-auto shrink-0 text-muted-foreground tabular-nums">
													P{cell.periodFrom}&ndash;{cell.periodTo}
												</span>
											{/if}
										</button>

										{#if cell.periodFrom === cell.periodTo}
											<BlockPopover
												scope="slot"
												subject={`${cell.classLabel}, P${cell.periodFrom}`}
												triggerClass="absolute top-1/2 right-1 -translate-y-1/2 rounded bg-background/80 p-0.5 text-muted-foreground opacity-0 group-hover/cell:opacity-100 focus-visible:opacity-100"
											>
												{#snippet trigger()}<BanIcon class="size-3" />{/snippet}
											</BlockPopover>
										{/if}
									{/if}
								</td>
							{/if}
						{/each}
					</tr>
				{/each}
			</tbody>
		{/each}
	</table>
</div>
