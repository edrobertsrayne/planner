<!--
	PROTOTYPE — throwaway. Slot grid design 3 — "the fortnight strip".
	Axes flipped: days down the rows, Periods across, Week A stacked above Week B. Ten short rows
	of six instead of two blocks of six rows of five, so the whole fortnight fits one narrow column
	and can sit beside something else. Reads like a diary rather than a timetable, and at the `xs`
	density the grids are allowed.
-->
<script lang="ts">
	import { DAYS, PERIODS, WEEKS, slotAt, SUBJECT } from './fixtures';
</script>

<div class="space-y-4">
	{#each WEEKS as week (week)}
		<div>
			<div class="mb-1 flex items-center gap-2">
				<span class="text-xs font-semibold tracking-wide uppercase">Week {week}</span>
				<div class="h-px flex-1 bg-border"></div>
			</div>
			<table class="w-full border-separate border-spacing-0.5">
				<thead>
					<tr>
						<th class="w-9"></th>
						{#each PERIODS as p (p)}
							<th class="pb-0.5 text-[0.625rem] font-medium text-muted-foreground">P{p}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each DAYS as d, i (d)}
						<tr>
							<th class="pr-1.5 text-right text-[0.625rem] font-normal text-muted-foreground">
								{d}
							</th>
							{#each PERIODS as p (p)}
								{@const slot = slotAt(week, i + 1, p)}
								{@const mine = slot?.classId === SUBJECT.classId}
								<td>
									{#if mine}
										<button
											type="button"
											class="h-5 w-full rounded-sm bg-primary text-[0.625rem] leading-none font-medium text-primary-foreground hover:bg-primary/80"
											aria-label="Week {week} {d} P{p} — {SUBJECT.classLabel}, click to clear"
										>
											{SUBJECT.classLabel}
										</button>
									{:else if slot}
										<div
											title="Held by {slot.classLabel}"
											class="flex h-5 w-full cursor-not-allowed items-center justify-center rounded-sm bg-muted/60 text-[0.5rem] leading-none text-muted-foreground/60 inset-ring inset-ring-border"
										>
											{slot.classLabel}
										</div>
									{:else}
										<button
											type="button"
											class="h-5 w-full rounded-sm bg-muted/30 hover:bg-muted"
											aria-label="Week {week} {d} P{p} — empty, click to give it to {SUBJECT.classLabel}"
										></button>
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/each}
</div>
