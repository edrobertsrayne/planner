<script lang="ts">
	import { enhance } from '$app/forms';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { onFail } from '$lib/client/enhance';
	import { formatDate } from '$lib/date';
	import { POSITIONS, positionLabel } from '$lib/events';
	import { Button } from '$lib/ui';

	// The same Timetable grid as a Class page's, with the two extra rows only Events hold. A position
	// a Class or another Event holds is hatched and locked, so a clash is never offered (ADR-0029).
	type ClassSlot = { classId: string; week: 'A' | 'B'; day: number; period: number };
	type EventSlot = {
		eventId: string;
		name: string;
		week: 'A' | 'B';
		day: number;
		position: number;
	};

	let {
		eventId,
		eventName,
		on,
		readOnly,
		classSlots,
		eventSlots,
		labelOf
	}: {
		eventId: string;
		eventName: string;
		on: string;
		readOnly: boolean;
		classSlots: ClassSlot[];
		eventSlots: EventSlot[];
		labelOf: (classId: string) => string;
	} = $props();

	const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
	const WEEKS = ['A', 'B'] as const;

	type Cell = { kind: 'mine' | 'other' | 'empty'; label: string };

	function cellAt(week: 'A' | 'B', day: number, position: number): Cell {
		const own = eventSlots.find((s) => s.week === week && s.day === day && s.position === position);
		if (own) {
			return own.eventId === eventId
				? { kind: 'mine', label: eventName }
				: { kind: 'other', label: own.name };
		}
		const cls = classSlots.find((s) => s.week === week && s.day === day && s.period === position);
		return cls ? { kind: 'other', label: labelOf(cls.classId) } : { kind: 'empty', label: '' };
	}

	function describe(cell: Cell, week: 'A' | 'B', day: string, position: number): string {
		const where = `Week ${week} ${day} ${positionLabel(position)}`;
		const state =
			cell.kind === 'mine' ? eventName : cell.kind === 'other' ? `held by ${cell.label}` : 'empty';
		const then = readOnly
			? `as at ${formatDate(on)}`
			: cell.kind === 'mine'
				? 'click to clear'
				: cell.kind === 'empty'
					? `click to give it to ${eventName}`
					: '';
		return then ? `${where} — ${state}, ${then}` : `${where} — ${state}`;
	}

	const slotsIn = (week: 'A' | 'B') =>
		eventSlots.filter((s) => s.eventId === eventId && s.week === week).length;
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
						<th class="w-24"></th>
						{#each DAYS as d (d)}
							<th class="w-1/5 pb-1 text-xs font-medium text-muted-foreground">{d}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each POSITIONS as p (p)}
						<tr>
							<th
								class="pr-2 text-right text-xs font-normal whitespace-nowrap text-muted-foreground"
							>
								{positionLabel(p)}
							</th>
							{#each DAYS as d, i (d)}
								{@const cell = cellAt(w, i + 1, p)}
								{@const description = describe(cell, w, d, p)}
								<td>
									{#if cell.kind === 'other'}
										<div
											role="img"
											class="flex h-9 w-full cursor-not-allowed items-center justify-center rounded-md bg-muted/60 px-1 text-[11px] text-muted-foreground/80 inset-ring inset-ring-border"
											title="Held by {cell.label}"
											aria-label={description}
										>
											<span class="truncate">{cell.label}</span>
										</div>
									{:else if readOnly && cell.kind === 'mine'}
										<div
											role="img"
											class="flex h-9 w-full items-center justify-center rounded-md bg-primary/10 px-1 text-[11px] font-medium text-primary inset-ring inset-ring-primary/30"
											aria-label={description}
										>
											<span class="truncate">{cell.label}</span>
										</div>
									{:else if readOnly}
										<div
											role="img"
											class="h-9 w-full rounded-md border border-dashed opacity-40"
											aria-label={description}
										></div>
									{:else}
										<form
											method="POST"
											action="?/toggleEventSlot"
											use:enhance={onFail('Could not change the Timetable.')}
										>
											<input type="hidden" name="eventId" value={eventId} />
											<input type="hidden" name="week" value={w} />
											<input type="hidden" name="day" value={i + 1} />
											<input type="hidden" name="position" value={p} />
											<input type="hidden" name="from" value={on} />
											{#if cell.kind === 'mine'}
												<Button
													type="submit"
													size="xs"
													class="h-9 w-full overflow-hidden"
													aria-label={description}
												>
													<span class="truncate">{cell.label}</span>
												</Button>
											{:else}
												<Button
													type="submit"
													variant="outline"
													size="xs"
													class="h-9 w-full border-dashed text-muted-foreground/40 hover:border-solid hover:text-foreground"
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
