<!-- PROTOTYPE — throwaway. The Calendar's Periods x Days grid, restyled on rhea/shadcn at the
     xs / h-5 grid density (map convention). Week nav simplified to prev/next for the prototype —
     the ribbon isn't what this ticket is judging. -->
<script lang="ts">
	import { classTone } from '$lib/client/class-tone';
	import type { Occasion } from '$lib/client/session-panel.svelte';
	import type { CalendarCell } from '$lib/server/planner';

	let {
		week,
		prev,
		next,
		onNav,
		onOpen,
		selected = null
	}: {
		week: { weekCommencing: string; letter: string; dates: string[]; cells: CalendarCell[] } | null;
		prev: string | null;
		next: string | null;
		onNav: (weekCommencing: string) => void;
		onOpen: (occasion: Occasion) => void;
		selected?: Occasion | null;
	} = $props();

	const isSelected = (cell: CalendarCell) =>
		!!selected &&
		selected.classId === cell.classId &&
		selected.date === cell.date &&
		selected.period === cell.periodFrom;

	const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
	const PERIODS = [1, 2, 3, 4, 5, 6];

	type GridEntry = { type: 'start'; cell: CalendarCell } | { type: 'covered' } | { type: 'free' };

	const grid = $derived.by(() => {
		const dates = week?.dates ?? [];
		const matrix: GridEntry[][] = dates.map(() => PERIODS.map((): GridEntry => ({ type: 'free' })));
		for (const cell of week?.cells ?? []) {
			const di = dates.indexOf(cell.date);
			if (di < 0) continue;
			matrix[di][cell.periodFrom - 1] = { type: 'start', cell };
			for (let p = cell.periodFrom + 1; p <= cell.periodTo; p++)
				matrix[di][p - 1] = { type: 'covered' };
		}
		return matrix;
	});

	const fmtDay = (iso: string) =>
		new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short',
			timeZone: 'UTC'
		});
</script>

{#if !week}
	<p class="text-sm text-muted-foreground">This is not a Teaching Week.</p>
{:else}
	<div class="mb-3 flex items-center gap-2">
		<button
			type="button"
			class="rounded px-2 py-1 text-muted-foreground {prev
				? 'hover:bg-muted'
				: 'pointer-events-none opacity-30'}"
			onclick={() => prev && onNav(prev)}
			aria-label="Previous Teaching Week">←</button
		>
		<span class="text-sm font-medium">w/c {fmtDay(week.weekCommencing)} — Week {week.letter}</span>
		<button
			type="button"
			class="rounded px-2 py-1 text-muted-foreground {next
				? 'hover:bg-muted'
				: 'pointer-events-none opacity-30'}"
			onclick={() => next && onNav(next)}
			aria-label="Next Teaching Week">→</button
		>
	</div>

	<div class="overflow-x-auto">
		<table class="w-full border-separate border-spacing-1 text-xs">
			<thead>
				<tr>
					<th class="w-8"></th>
					{#each DAY_NAMES as d, i (d)}
						<th class="pb-1 text-left text-[11px] font-semibold text-muted-foreground">
							{d} <span class="font-normal">{fmtDay(week.dates[i])}</span>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each PERIODS as period (period)}
					<tr>
						<th class="pr-1 text-right align-top text-[10px] font-medium text-muted-foreground"
							>P{period}</th
						>
						{#each DAY_NAMES as d, di (d)}
							{@const entry = grid[di][period - 1]}
							{#if entry.type === 'covered'}
								<!-- covered by an earlier period's rowspan -->
							{:else if entry.type === 'free'}
								<td class="h-5 w-28 rounded bg-muted/40"></td>
							{:else}
								{@const cell = entry.cell}
								{@const rowspan = cell.periodTo - cell.periodFrom + 1}
								{@const tone = classTone(cell.classId)}
								<td {rowspan} class="align-top">
									{#if cell.kind === 'blocked'}
										<div
											class="h-full min-h-5 w-28 rounded border border-dashed border-border bg-[repeating-linear-gradient(135deg,var(--muted)_0_4px,transparent_4px_8px)] px-1 py-0.5"
										>
											<div class="text-[10px] font-bold text-muted-foreground">
												{cell.classLabel}
											</div>
										</div>
									{:else}
										<button
											type="button"
											class="h-full min-h-5 w-28 rounded border-l-2 {tone.border} {tone.bg} px-1 py-0.5 text-left hover:brightness-95 {isSelected(
												cell
											)
												? 'ring-2 ring-ring'
												: ''}"
											onclick={() =>
												onOpen({
													classId: cell.classId,
													date: cell.date,
													period: cell.periodFrom
												})}
										>
											<div class="text-[10px] font-bold {tone.text}">{cell.classLabel}</div>
											{#if cell.kind === 'lesson'}
												<div class="line-clamp-2 text-[9px] leading-tight text-foreground/80">
													{cell.lesson?.title}
												</div>
											{:else}
												<div class="text-[9px] text-muted-foreground italic">Unplanned</div>
											{/if}
										</button>
									{/if}
								</td>
							{/if}
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
