<!--
	PROTOTYPE — throwaway. Slot grid design 1 — "the pair".
	Today's orientation (Periods down, days across) and today's arrangement (Week A and Week B side
	by side), but at a comfortable editing density rather than the Teaching Week's `xs`. Argues that
	this grid is an *editor* and its cells are click targets, so it should be deliberately looser
	than the read-only Calendar grid even though both are fortnight grids.
-->
<script lang="ts">
	import { DAYS, PERIODS, WEEKS, slotAt, SUBJECT } from './fixtures';
</script>

<div class="flex flex-wrap gap-8">
	{#each WEEKS as week (week)}
		<table class="border-separate border-spacing-1">
			<thead>
				<tr>
					<th
						class="w-14 pb-1 text-left text-xs font-semibold whitespace-nowrap text-muted-foreground"
					>
						Week {week}
					</th>
					{#each DAYS as d (d)}
						<th class="w-16 pb-1 text-xs font-medium text-muted-foreground">{d}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each PERIODS as p (p)}
					<tr>
						<th class="pr-1 text-right text-xs font-normal text-muted-foreground">P{p}</th>
						{#each DAYS as d, i (d)}
							{@const slot = slotAt(week, i + 1, p)}
							{@const mine = slot?.classId === SUBJECT.classId}
							<td>
								{#if mine}
									<button
										type="button"
										class="h-8 w-16 rounded-md bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/80"
										aria-label="Week {week} {d} P{p} — {SUBJECT.classLabel}, click to clear"
									>
										{SUBJECT.classLabel.split('/')[0]}
									</button>
								{:else if slot}
									<div
										title="Held by {slot.classLabel}"
										class="flex h-8 w-16 cursor-not-allowed items-center justify-center rounded-md bg-muted/60 text-[0.625rem] text-muted-foreground/70 inset-ring inset-ring-border"
									>
										{slot.classLabel}
									</div>
								{:else}
									<button
										type="button"
										class="h-8 w-16 rounded-md border border-dashed text-xs text-muted-foreground/40 hover:border-solid hover:bg-muted hover:text-foreground"
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
	{/each}
</div>
