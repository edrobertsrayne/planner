<!--
	PROTOTYPE ONLY (issue #313). One week of the Slot grid for one Class, as on today's Class page:
	this Class's Periods filled, another Class's carrying its label, the rest empty. A click toggles
	the cell locally. `cell` sets the height so variants can try denser or roomier grids.
-->
<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import {
		DAYS,
		PERIODS,
		labelOf,
		slotAt,
		slotsOf,
		toggleSlot,
		type Klass,
		type Week
	} from './store.svelte';

	let {
		klass,
		week,
		readOnly = false,
		cell = 'h-8',
		heading = true
	}: { klass: Klass; week: Week; readOnly?: boolean; cell?: string; heading?: boolean } = $props();
</script>

<div>
	{#if heading}
		<div class="mb-2 flex items-baseline gap-2">
			<h3 class="text-sm font-semibold">Week {week}</h3>
			<span class="text-xs text-muted-foreground tabular-nums"
				>{slotsOf(klass.id, week).length} Slots</span
			>
			<div class="ml-2 h-px flex-1 bg-border"></div>
		</div>
	{/if}
	<table class="w-full table-fixed border-separate border-spacing-1">
		<thead>
			<tr>
				<th class="w-8"></th>
				{#each DAYS as d (d)}
					<th class="pb-1 text-xs font-medium text-muted-foreground">{d}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each PERIODS as p (p)}
				<tr>
					<th class="pr-1 text-right text-xs font-normal text-muted-foreground">P{p}</th>
					{#each DAYS as d, i (d)}
						{@const s = slotAt(week, i + 1, p)}
						{@const mine = s?.classId === klass.id}
						<td>
							{#if s && !mine}
								<div
									class="flex {cell} w-full items-center justify-center truncate rounded-md bg-muted/60 text-[11px] text-muted-foreground/80 inset-ring inset-ring-border"
									title="Held by {labelOf(s.classId)}"
								>
									{labelOf(s.classId)}
								</div>
							{:else if readOnly}
								<div
									class="flex {cell} w-full items-center justify-center rounded-md text-[11px] font-medium {mine
										? 'bg-primary/10 text-primary inset-ring inset-ring-primary/30'
										: 'border border-dashed opacity-40'}"
								>
									{mine ? klass.label : ''}
								</div>
							{:else}
								<button
									type="button"
									onclick={() => toggleSlot(klass.id, week, i + 1, p)}
									aria-label="Week {week} {d} P{p}"
									class="flex {cell} w-full items-center justify-center rounded-md text-xs font-medium {mine
										? 'bg-primary text-primary-foreground hover:bg-primary/90'
										: 'border border-dashed text-muted-foreground/40 hover:border-solid hover:text-foreground'}"
								>
									{#if mine}{klass.label}{:else}<PlusIcon class="size-3" />{/if}
								</button>
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
