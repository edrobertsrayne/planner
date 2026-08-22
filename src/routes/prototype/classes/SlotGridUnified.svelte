<!--
	PROTOTYPE — throwaway. Slot grid design 2 — "one week at a time".
	One grid, not two, with the fortnight behind a Week A / Week B segmented control. Half the
	width, so the grid can be wide and legible; the cost is that the fortnight is never seen whole,
	and a Class taught the same Period in both weeks is no longer visibly symmetric. It carries a
	count of the other week's Slots so the hidden half is at least accounted for.
-->
<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { DAYS, PERIODS, WEEKS, GRID, slotAt, SUBJECT, type Week } from './fixtures';

	let week = $state<Week>('A');

	const mineIn = (w: Week) =>
		GRID.filter((s) => s.week === w && s.classId === SUBJECT.classId).length;
</script>

<div class="space-y-3">
	<Tabs.Root value={week} onValueChange={(v) => (week = v as Week)}>
		<Tabs.List>
			{#each WEEKS as w (w)}
				<Tabs.Trigger value={w} class="px-4">
					Week {w}
					<span class="ml-1.5 text-xs text-muted-foreground tabular-nums">{mineIn(w)}</span>
				</Tabs.Trigger>
			{/each}
		</Tabs.List>
	</Tabs.Root>

	<table class="w-full border-separate border-spacing-1">
		<thead>
			<tr>
				<th class="w-10"></th>
				{#each DAYS as d (d)}
					<th class="pb-1 text-xs font-medium text-muted-foreground">{d}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each PERIODS as p (p)}
				<tr>
					<th class="pr-2 text-right text-xs font-normal whitespace-nowrap text-muted-foreground">
						Period {p}
					</th>
					{#each DAYS as d, i (d)}
						{@const slot = slotAt(week, i + 1, p)}
						{@const mine = slot?.classId === SUBJECT.classId}
						<td class="w-1/5">
							{#if mine}
								<button
									type="button"
									class="h-9 w-full rounded-md bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/80"
									aria-label="Week {week} {d} P{p} — {SUBJECT.classLabel}, click to clear"
								>
									{SUBJECT.classLabel}
								</button>
							{:else if slot}
								<div
									class="flex h-9 w-full cursor-not-allowed items-center justify-center rounded-md bg-muted/60 text-xs text-muted-foreground/70 inset-ring inset-ring-border"
								>
									{slot.classLabel}
								</div>
							{:else}
								<button
									type="button"
									class="h-9 w-full rounded-md border border-dashed text-xs text-muted-foreground/40 hover:border-solid hover:bg-muted hover:text-foreground"
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
