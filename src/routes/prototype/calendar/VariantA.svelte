<!--
	PROTOTYPE — throwaway. A — The tiles.

	Today's grid, kept and refined. Periods down, days across, each occasion a rounded tile with
	room for a Class label, a title over three lines and a control. The structural claim is that a
	Session on the Calendar is a *card* — the same object the Agenda shows as a row — and that the
	fortnight is worth the vertical space that costs.

	`min-h-16` and `w-40` survive from the current screen; what changes is that the tile is built
	from tokens (card, border, muted) with the tone applied by the `?class=` axis, the blocked
	states are drained rather than hex-hatched, and the block control is a real Popover.
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

{#each weeks as week (week.letter)}
	{@const monday = week.monday}
	{@const grid = toGrid(week.cells)}
	{#if weeks.length > 1}
		<h2 class="pt-4 pb-1 text-sm font-semibold first:pt-0">
			Week {week.letter}
			<span class="font-normal text-muted-foreground">w/c {fmtDay(monday)}</span>
		</h2>
	{/if}
	<div class="overflow-x-auto">
		<!-- `table-fixed` keeps the day columns the same width in both halves of the fortnight,
		     which two independently-sized tables otherwise get wrong. -->
		<table class="w-full table-fixed border-separate border-spacing-1.5">
			<thead>
				<tr>
					<th class="w-12"></th>
					{#each DAY_NAMES as d, di (d)}
						{@const blocked = week.letter === 'A' && di === BLOCKED_DAY_INDEX}
						<th class="pb-1 text-left align-bottom">
							<div class="flex items-baseline gap-1.5">
								<span class="text-sm font-semibold">{d}</span>
								<span class="text-xs font-normal text-muted-foreground"
									>{fmtDay(addDays(monday, di))}</span
								>
								{#if blocked}
									<span
										class="ml-auto rounded-2xl bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
									>
										{BLOCKED_DAY_LABEL}
									</span>
								{:else}
									<BlockPopover
										scope="day"
										subject={`${d} ${fmtDay(addDays(monday, di))}`}
										triggerClass="ml-auto rounded px-1 text-xs font-normal text-muted-foreground/50 hover:text-foreground focus-visible:text-foreground"
									>
										{#snippet trigger()}Block day{/snippet}
									</BlockPopover>
								{/if}
							</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each PERIODS as period (period)}
					<tr class="group/row">
						<th class="pr-1 text-right align-top">
							<div class="pt-1 text-xs font-medium text-muted-foreground tabular-nums">
								P{period}
								<span class="block text-xs font-normal opacity-70">{PERIOD_TIMES[period]}</span>
							</div>
						</th>

						{#each DAY_NAMES as d, di (d)}
							{@const entry = grid[di][period - 1]}
							{#if entry.type === 'covered'}
								<!-- covered by an earlier Period's rowspan -->
							{:else if entry.type === 'free'}
								<td class="h-16 rounded-md bg-muted/40"></td>
							{:else}
								{@const cell = entry.cell}
								{@const span = cell.periodTo - cell.periodFrom + 1}
								{@const s = skin(cell.tone, cue)}
								<!-- the explicit `h-16` is what lets `h-full` inside resolve, so a multi-Period
									 Lesson's tile actually fills the Periods it spans -->
								<td rowspan={span} class="group/cell relative h-16 align-top">
									{#if cell.kind === 'blocked'}
										<div
											class="hatched flex h-full min-h-16 flex-col rounded-md border border-dashed px-2 py-1.5"
										>
											<div class="text-xs font-semibold text-muted-foreground">
												{cell.classLabel}
											</div>
											<div class="mt-0.5 text-xs text-muted-foreground/80 italic">
												{cell.blockedNote ?? BLOCKED_DAY_LABEL}
											</div>
											<button
												type="button"
												class="mt-auto self-start text-xs text-muted-foreground underline underline-offset-2 opacity-0 group-hover/cell:opacity-100 focus-visible:opacity-100"
											>
												{cell.fromBlockedDay ? 'Unblock day' : 'Unblock'}
											</button>
										</div>
									{:else}
										<button
											type="button"
											data-session-trigger
											class="relative flex h-full min-h-16 w-full flex-col overflow-hidden rounded-md border bg-card px-2 py-1.5 text-left hover:bg-muted/50"
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
												{#if s.chipBg}
													<span
														class="rounded-2xl px-1.5 text-xs font-medium"
														style:background-color={s.chipBg}
														style:color={s.chipFg}>{cell.classLabel}</span
													>
												{:else}
													<span class="text-xs font-semibold" style:color={s.labelFg}
														>{cell.classLabel}</span
													>
												{/if}
											</span>

											{#if cell.lesson}
												<span
													class="mt-1 line-clamp-3 text-xs leading-tight {s.stripe ? 'pl-1.5' : ''}"
												>
													{cell.lesson.title}
												</span>
											{:else}
												<span
													class="mt-1 text-xs text-muted-foreground italic {s.stripe
														? 'pl-1.5'
														: ''}">Unplanned</span
												>
											{/if}
										</button>

										{#if cell.periodFrom === cell.periodTo}
											<!--
											A Lesson with a Planned Length above one spans several Periods as one merged
											cell (#36); a Blocked Slot is only ever one Period (#39), so the control is
											offered solely where "this Period" is unambiguous. Unchanged rule, real
											Popover.
										-->
											<BlockPopover
												scope="slot"
												subject={`${cell.classLabel}, P${cell.periodFrom}`}
												triggerClass="absolute top-1 right-1 rounded p-0.5 text-muted-foreground opacity-0 group-hover/cell:opacity-100 focus-visible:opacity-100 hover:bg-background/70"
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
		</table>
	</div>
{/each}
