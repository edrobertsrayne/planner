<script lang="ts">
	import { enhance } from '$app/forms';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { onFail } from '$lib/client/enhance';
	import { formatDate } from '$lib/date';
	import { Button } from '$lib/components/ui/button/index.js';

	// The Timetable as it stands on one date: this Class's Periods, every other Class's shown
	// hatched, and the rest empty. Clicking a cell toggles it — the server decides between taking
	// and clearing from who holds the position, so both are the same POST and the grid never has
	// to work out which it means.
	//
	// A date before today is the record of what was taught, not a plan, so the whole grid renders
	// read-only (ADR-0006, amended): same three states, no forms.
	type Slot = { classId: string; week: 'A' | 'B'; day: number; period: number };

	let {
		classId,
		classLabel,
		on,
		readOnly,
		slots,
		labelOf
	}: {
		classId: string;
		classLabel: string;
		// The date the grid is showing, which is also what a change applies from.
		on: string;
		readOnly: boolean;
		slots: Slot[];
		labelOf: (classId: string) => string;
	} = $props();

	const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
	const PERIODS = [1, 2, 3, 4, 5, 6];
	const WEEKS = ['A', 'B'] as const;

	// One of three, whoever holds the position and whenever the grid is dated — so the markup
	// below branches on what a cell *is*, not on a chain of who-and-when.
	type Cell = { kind: 'mine' | 'other' | 'empty'; label: string };

	function cellAt(week: 'A' | 'B', day: number, period: number): Cell {
		const slot = slots.find((s) => s.week === week && s.day === day && s.period === period);
		if (!slot) return { kind: 'empty', label: '' };
		if (slot.classId === classId) return { kind: 'mine', label: classLabel.split('/')[0] };
		return { kind: 'other', label: labelOf(slot.classId) };
	}

	// "Week A Mon P3 — 10B/Sc1, click to clear": what the cell is, then what clicking does.
	function describe(cell: Cell, week: 'A' | 'B', day: string, period: number): string {
		const position = `Week ${week} ${day} P${period}`;
		const state =
			cell.kind === 'mine' ? classLabel : cell.kind === 'other' ? `held by ${cell.label}` : 'empty';
		const then = readOnly
			? `as at ${formatDate(on)}`
			: cell.kind === 'mine'
				? 'click to clear'
				: cell.kind === 'empty'
					? `click to give it to ${classLabel}`
					: '';
		return then ? `${position} — ${state}, ${then}` : `${position} — ${state}`;
	}

	const slotsIn = (week: 'A' | 'B') =>
		slots.filter((s) => s.classId === classId && s.week === week).length;
</script>

<div class="space-y-5">
	{#each WEEKS as w (w)}
		<div>
			<div class="mb-2 flex items-baseline gap-2">
				<h3 class="text-sm font-semibold">Week {w}</h3>
				<span class="text-xs text-muted-foreground tabular-nums">{slotsIn(w)} Slots</span>
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
								{@const cell = cellAt(w, i + 1, p)}
								{@const description = describe(cell, w, d, p)}
								<td>
									{#if cell.kind === 'other'}
										<div
											class="flex h-8 w-full cursor-not-allowed items-center justify-center rounded-md bg-muted/60 text-[11px] text-muted-foreground/80 inset-ring inset-ring-border"
											title="Held by {cell.label}"
											aria-label={description}
										>
											{cell.label}
										</div>
									{:else if readOnly && cell.kind === 'mine'}
										<div
											class="flex h-8 w-full items-center justify-center rounded-md bg-primary/10 text-[11px] font-medium text-primary inset-ring inset-ring-primary/30"
											aria-label={description}
										>
											{cell.label}
										</div>
									{:else if readOnly}
										<div
											class="h-8 w-full rounded-md border border-dashed opacity-40"
											aria-label={description}
										></div>
									{:else}
										<form
											method="POST"
											action="?/toggleSlot"
											use:enhance={onFail('Could not change the Timetable.')}
										>
											<input type="hidden" name="classId" value={classId} />
											<input type="hidden" name="week" value={w} />
											<input type="hidden" name="day" value={i + 1} />
											<input type="hidden" name="period" value={p} />
											<input type="hidden" name="from" value={on} />
											{#if cell.kind === 'mine'}
												<Button type="submit" size="xs" class="h-8 w-full" aria-label={description}>
													{cell.label}
												</Button>
											{:else}
												<Button
													type="submit"
													variant="outline"
													size="xs"
													class="h-8 w-full border-dashed text-muted-foreground/40 hover:border-solid hover:text-foreground"
													aria-label={description}
												>
													<PlusIcon class="size-3" />
												</Button>
											{/if}
										</form>
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
