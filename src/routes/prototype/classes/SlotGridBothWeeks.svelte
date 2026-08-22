<!--
	PROTOTYPE — throwaway. Slot grid design 4 — "both weeks, spacious".
	B's orientation and density (Periods down, days across, cells wide enough to carry a full Class
	label) but with nothing hidden: Week A and Week B as two blocks stacked down the column. Costs
	height — the fortnight is about 700px tall, so the rail beside it scrolls past — and buys back
	the thing B gives up, which is seeing the whole fortnight at once.
-->
<script lang="ts">
	import { DAYS, PERIODS, WEEKS, slotAt, SUBJECT, GRID } from './fixtures';

	const mineIn = (w: (typeof WEEKS)[number]) =>
		GRID.filter((s) => s.week === w && s.classId === SUBJECT.classId).length;
</script>

<div class="space-y-5">
	{#each WEEKS as week (week)}
		<div>
			<div class="mb-2 flex items-baseline gap-2">
				<h3 class="text-sm font-semibold">Week {week}</h3>
				<span class="text-xs text-muted-foreground tabular-nums">{mineIn(week)} Slots</span>
				<div class="ml-2 h-px flex-1 bg-border"></div>
			</div>

			<table class="w-full border-separate border-spacing-1">
				<thead>
					<tr>
						<th class="w-10"></th>
						{#each DAYS as d (d)}
							<th class="w-1/5 pb-1 text-xs font-medium text-muted-foreground">{d}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each PERIODS as p (p)}
						<tr>
							<th
								class="pr-2 text-right text-xs font-normal whitespace-nowrap text-muted-foreground"
							>
								P{p}
							</th>
							{#each DAYS as d, i (d)}
								{@const slot = slotAt(week, i + 1, p)}
								{@const mine = slot?.classId === SUBJECT.classId}
								<td>
									{#if mine}
										<button
											type="button"
											class="h-8 w-full rounded-md bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/80"
											aria-label="Week {week} {d} P{p} — {SUBJECT.classLabel}, click to clear"
										>
											{SUBJECT.classLabel}
										</button>
									{:else if slot}
										<div
											class="flex h-8 w-full cursor-not-allowed items-center justify-center rounded-md bg-muted/60 text-xs text-muted-foreground/70 inset-ring inset-ring-border"
										>
											{slot.classLabel}
										</div>
									{:else}
										<button
											type="button"
											class="h-8 w-full rounded-md border border-dashed text-xs text-muted-foreground/40 hover:border-solid hover:bg-muted hover:text-foreground"
											aria-label="Week {week} {d} P{p} — empty, click to give it to {SUBJECT.classLabel}"
										>
											+
										</button>
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
