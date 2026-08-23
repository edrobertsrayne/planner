<script lang="ts">
	import { enhance } from '$app/forms';
	import { classTone } from '$lib/class-tone';
	import { openSession } from '$lib/client/session-panel.svelte';
	import type { CalendarCell } from '$lib/server/planner';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
	const PERIODS = [1, 2, 3, 4, 5, 6];

	type GridEntry = { type: 'start'; cell: CalendarCell } | { type: 'covered' } | { type: 'free' };

	// One entry per (day, period): the cell that starts there, a period covered by an earlier
	// cell's rowspan (a Lesson with Planned Length > 1), or genuinely free.
	const grid = $derived.by(() => {
		const dates = data.week?.dates ?? [];
		const matrix: GridEntry[][] = dates.map(() => PERIODS.map((): GridEntry => ({ type: 'free' })));
		for (const cell of data.week?.cells ?? []) {
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

	const blockedByDate = $derived(new Map((data.week?.blockedDays ?? []).map((b) => [b.date, b])));
</script>

<svelte:head><title>Calendar</title></svelte:head>

<div class="mx-auto max-w-5xl px-6 py-6">
	{#if form?.atRisk && form.atRisk.length > 0}
		<div class="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
			<p class="font-bold">
				The Rewind changed the Lesson on {form.atRisk.length === 1
					? 'a noted Session'
					: `${form.atRisk.length} noted Sessions`} — check the note still applies.
			</p>
			<ul class="mt-1 space-y-0.5">
				{#each form.atRisk as s (s.classId + s.date + s.period)}
					<li>{s.classLabel} · {s.date} P{s.period} — now {s.lessonTitle}</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if data.ribbon.length === 0}
		<p class="text-sm text-neutral-400">No Teaching Weeks are set up yet.</p>
	{:else}
		<div class="mb-4 flex flex-wrap items-center gap-2">
			<!-- eslint-disable svelte/no-navigation-without-resolve -- carries a query string -->
			<a
				href={data.prev ? `?week=${data.prev}` : undefined}
				class="rounded px-2 py-1 text-neutral-400 {data.prev
					? 'hover:bg-neutral-200'
					: 'pointer-events-none opacity-30'}"
				aria-label="Previous Teaching Week">←</a
			>
			{#each data.ribbon as w (w.weekCommencing)}
				{@const isSelected = w.weekCommencing === data.selected}
				<a
					href={`?week=${w.weekCommencing}`}
					class="rounded px-2.5 py-1 text-xs font-bold {isSelected
						? w.letter === 'A'
							? 'bg-neutral-900 text-white'
							: 'bg-white text-neutral-900 ring-2 ring-neutral-900'
						: 'text-neutral-400 hover:bg-neutral-200'}"
					title="w/c {fmtDay(w.weekCommencing)}">{w.letter}</a
				>
			{/each}
			<a
				href={data.next ? `?week=${data.next}` : undefined}
				class="rounded px-2 py-1 text-neutral-400 {data.next
					? 'hover:bg-neutral-200'
					: 'pointer-events-none opacity-30'}"
				aria-label="Next Teaching Week">→</a
			>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->

			{#if data.week}
				<span class="text-sm text-neutral-500">w/c {fmtDay(data.week.weekCommencing)}</span>

				<form
					method="POST"
					action="?/setLetter"
					class="ml-auto"
					use:enhance={() =>
						async ({ update }) =>
							update({ invalidateAll: true })}
				>
					<input type="hidden" name="weekCommencing" value={data.week.weekCommencing} />
					<input type="hidden" name="letter" value={data.week.letter === 'A' ? 'B' : 'A'} />
					<button type="submit" class="text-xs text-neutral-500 underline hover:text-neutral-800">
						Stored as Week {data.week.letter} — switch to Week {data.week.letter === 'A'
							? 'B'
							: 'A'}
					</button>
				</form>
			{/if}
		</div>

		{#if !data.week}
			<p class="text-sm text-neutral-400">This is not a Teaching Week.</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full border-separate border-spacing-1 text-sm">
					<thead>
						<tr>
							<th class="w-10"></th>
							{#each DAY_NAMES as d, i (d)}
								{@const date = data.week.dates[i]}
								{@const blockedDay = blockedByDate.get(date)}
								<th class="pb-1 text-left text-xs font-semibold text-neutral-500">
									{d} <span class="font-normal text-neutral-400">{fmtDay(date)}</span>
									{#if blockedDay}
										<form
											method="POST"
											action="?/unblockDay"
											class="inline"
											use:enhance={() =>
												async ({ update }) =>
													update({ invalidateAll: true })}
										>
											<input type="hidden" name="id" value={blockedDay.id} />
											<button
												type="submit"
												class="ml-1 font-normal text-amber-600 underline hover:text-amber-800"
												title={blockedDay.note ?? 'Blocked day'}>blocked · remove</button
											>
										</form>
									{:else}
										<details class="inline">
											<summary
												class="cursor-pointer list-none font-normal text-neutral-300 underline hover:text-neutral-600"
												>block day</summary
											>
											<form
												method="POST"
												action="?/blockDay"
												class="mt-1 flex gap-1"
												use:enhance={() =>
													async ({ update }) =>
														update({ invalidateAll: true })}
											>
												<input type="hidden" name="date" value={date} />
												<input
													type="text"
													name="note"
													placeholder="Optional note"
													class="w-24 rounded border border-neutral-300 px-1 py-0.5 text-[11px] font-normal"
												/>
												<button
													type="submit"
													class="rounded bg-neutral-800 px-1.5 py-0.5 text-[11px] font-normal text-white"
													>Block</button
												>
											</form>
										</details>
									{/if}
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each PERIODS as period (period)}
							<tr>
								<th class="pr-1 text-right align-top text-xs font-medium text-neutral-400"
									>P{period}</th
								>
								{#each DAY_NAMES as d, di (d)}
									{@const entry = grid[di][period - 1]}
									{#if entry.type === 'covered'}
										<!-- covered by an earlier period's rowspan -->
									{:else if entry.type === 'free'}
										<td class="h-16 w-40 rounded bg-white/60"></td>
									{:else}
										{@const cell = entry.cell}
										{@const rowspan = cell.periodTo - cell.periodFrom + 1}
										{@const tone = classTone(cell.tone)}
										<td {rowspan} class="relative align-top">
											{#if cell.kind === 'blocked'}
												<div
													class="h-full min-h-16 w-40 rounded border border-dashed border-neutral-300 bg-[repeating-linear-gradient(135deg,#f5f5f5_0_6px,#fafafa_6px_12px)] px-2 py-1.5"
												>
													<div class="text-xs font-bold text-neutral-500">{cell.classLabel}</div>
													<div class="mt-0.5 text-[11px] text-neutral-400">
														{cell.blockedNote ?? 'Blocked'}
													</div>
													{#if cell.blockedSlotId}
														<form
															method="POST"
															action="?/unblockSlot"
															class="mt-1"
															use:enhance={() =>
																async ({ update }) =>
																	update({ invalidateAll: true })}
														>
															<input type="hidden" name="id" value={cell.blockedSlotId} />
															<button
																type="submit"
																class="text-[10px] text-amber-700 underline hover:text-amber-900"
																>Unblock</button
															>
														</form>
													{:else if cell.blockedDayId}
														<form
															method="POST"
															action="?/unblockDay"
															class="mt-1"
															use:enhance={() =>
																async ({ update }) =>
																	update({ invalidateAll: true })}
														>
															<input type="hidden" name="id" value={cell.blockedDayId} />
															<button
																type="submit"
																class="text-[10px] text-amber-700 underline hover:text-amber-900"
																>Unblock day</button
															>
														</form>
													{/if}
												</div>
											{:else}
												<button
													type="button"
													data-session-trigger
													class="h-full min-h-16 w-40 rounded border-l-4 px-2 py-1.5 text-left hover:brightness-95"
													style:background-color={tone.bg}
													style:border-left-color={tone.ring}
													onclick={() =>
														openSession({
															classId: cell.classId,
															date: cell.date,
															period: cell.periodFrom
														})}
												>
													<div class="text-xs font-bold" style:color={tone.fg}>
														{cell.classLabel}
													</div>
													{#if cell.kind === 'lesson'}
														<div
															class="mt-0.5 line-clamp-3 text-[11px] leading-tight text-neutral-700"
														>
															{cell.lesson?.title}
														</div>
													{:else}
														<div class="mt-0.5 text-[11px] text-neutral-400 italic">Unplanned</div>
													{/if}
												</button>
												{#if cell.periodFrom === cell.periodTo}
													<!-- A Lesson with Planned Length > 1 spans several Periods as one merged
													cell (issue #36); a Blocked Slot is only ever one Period (#39), so the
													control is offered solely on a cell that is exactly one Period wide,
													never on a span where "this Period" would be ambiguous. -->
													<details class="absolute top-0.5 right-0.5">
														<summary
															class="cursor-pointer list-none rounded bg-white/70 px-1 text-[9px] text-neutral-400 hover:text-neutral-700"
															title="Block this Slot">⊘</summary
														>
														<form
															method="POST"
															action="?/blockSlot"
															class="absolute top-full right-0 z-10 mt-1 w-40 rounded border border-neutral-300 bg-white p-1.5 shadow"
															use:enhance={() =>
																async ({ update }) =>
																	update({ invalidateAll: true })}
														>
															<input type="hidden" name="classId" value={cell.classId} />
															<input type="hidden" name="date" value={cell.date} />
															<input type="hidden" name="slotId" value={cell.slotId} />
															<input
																type="text"
																name="note"
																required
																placeholder="Why (required)"
																class="w-full rounded border border-neutral-300 px-1 py-0.5 text-[10px]"
															/>
															<button
																type="submit"
																class="mt-1 w-full rounded bg-neutral-800 px-1 py-0.5 text-[10px] text-white"
																>Block this Period</button
															>
														</form>
													</details>
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
			<p class="mt-3 text-[11px] text-neutral-400">
				Hatched = blocked (a Blocked Day, a Blocked Slot, or outside every Term). Coloured with no
				title = Unplanned — the Class is taught, nothing is planned for it yet. Click any Session to
				open it.
			</p>
		{/if}
	{/if}
</div>
