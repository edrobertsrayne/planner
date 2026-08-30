<!--
	PROTOTYPE — throwaway. Four variants of how the Calendar week tells its four states apart:
	an empty Term-time Period, a Lesson or Open Slot, a removal (Blocked Day or Blocked Slot),
	and a School Holiday. A won, so A now has three School Holiday treatments — A1, A2, A3 — that
	share A's structure and differ only in how far the Holiday panel stands away from an empty
	Period. B, C and D are kept for reference and still answer to ?variant=B|C|D. Fixture data,
	read only, no actions wired. Delete this file and prototype-fixture.ts once one wins.
-->
<script lang="ts">
	import PalmtreeIcon from '@lucide/svelte/icons/palmtree';
	import { classTone } from '$lib/class-tone';
	import { PERIODS, WEEK, toGrid, type Cell } from './prototype-fixture';

	let { variant = 'A2' }: { variant?: string } = $props();

	const grid = toGrid(WEEK);
	const teachingDays = WEEK.filter((d) => d.kind === 'teaching');
	const offDays = WEEK.filter((d) => d.kind !== 'teaching');
	const teachingGrid = toGrid(teachingDays);

	const tone = (c: Cell) => classTone(c.tone);

	// A1/A2/A3: the School Holiday panel, and the day head above it. Everything else in A is
	// identical across the three, so the only thing being judged is the Holiday.
	const HOLIDAY = {
		A1: { panel: 'proto-hol-warm', head: 'proto-hol-warm-head', rule: 'Warm tint' },
		A2: { panel: 'proto-hol-solid', head: '', rule: 'Solid panel' },
		A3: { panel: 'proto-hol-void', head: 'opacity-40', rule: 'Empty, ruled off' }
	} as const;
	type HolidayKey = keyof typeof HOLIDAY;
	const holiday = $derived(HOLIDAY[(variant in HOLIDAY ? variant : 'A2') as HolidayKey]);
</script>

{#if variant.startsWith('A')}
	<!-- A — Collapsed column. A day that is not taught stops being six Periods and becomes one
	     panel with the reason written once. Structure, not tint, carries the state. -->
	<div class="overflow-x-auto">
		<table class="w-full table-fixed border-separate border-spacing-1.5">
			<thead>
				<tr>
					<th class="w-12"></th>
					{#each WEEK as day (day.date)}
						<th class="pb-1 text-left align-bottom {day.kind === 'holiday' ? holiday.head : ''}">
							<div class="flex items-baseline gap-1.5">
								<span
									class="text-sm font-semibold {day.kind === 'teaching'
										? ''
										: 'text-muted-foreground'}">{day.name}</span
								>
								<span class="text-xs font-normal text-muted-foreground">{day.date}</span>
							</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each PERIODS as period (period)}
					<tr>
						<th class="pr-1 text-right align-top">
							<div class="pt-1.5 text-xs font-medium text-muted-foreground tabular-nums">
								P{period}
							</div>
						</th>
						{#each WEEK as day, di (day.date)}
							{#if day.kind !== 'teaching'}
								{#if period === 1}
									<td rowspan={6} class="h-16 align-middle">
										<div
											class="flex h-full flex-col items-center justify-center gap-1 rounded-lg px-2 py-3 text-center {day.kind ===
											'holiday'
												? holiday.panel
												: 'proto-a-blocked border border-dashed border-muted-foreground/30'}"
										>
											{#if day.kind === 'holiday'}
												<PalmtreeIcon class="proto-hol-icon size-5" />
											{/if}
											<div class="text-xs font-semibold text-muted-foreground">{day.note}</div>
											<div class="text-[11px] text-muted-foreground/70">
												{day.kind === 'holiday' ? 'Outside every Term' : 'No teaching'}
											</div>
											{#if day.kind === 'blocked'}
												<button
													type="button"
													class="mt-1 text-[11px] text-muted-foreground underline underline-offset-2"
													>Unblock day</button
												>
											{/if}
										</div>
									</td>
								{/if}
							{:else}
								{@const entry = grid[di][period - 1]}
								{#if entry.type === 'covered'}
									<!-- spanned -->
								{:else if entry.type === 'free'}
									<td class="h-16 rounded-lg bg-muted/40"></td>
								{:else}
									{@const cell = entry.cell}
									<td rowspan={cell.span} class="h-16 align-top">
										{#if cell.kind === 'blocked'}
											<div
												class="proto-a-blocked flex h-full min-h-16 flex-col rounded-lg border border-dashed border-muted-foreground/30 px-2 py-1.5"
											>
												<div class="text-xs font-semibold text-muted-foreground line-through">
													{cell.classLabel}
												</div>
												<div class="mt-0.5 text-xs text-muted-foreground/80 italic">
													{cell.note}
												</div>
											</div>
										{:else}
											{@const t = tone(cell)}
											<div
												class="flex h-full min-h-16 flex-col rounded-lg border px-2 py-1.5"
												style:background-color={t.bg}
												style:border-color={t.ring}
											>
												<span class="truncate text-xs font-semibold" style:color={t.fg}
													>{cell.classLabel}</span
												>
												{#if cell.kind === 'lesson'}
													<span
														class="mt-0.5 line-clamp-2 text-xs leading-tight font-medium"
														style:color={t.fg}>{cell.title}</span
													>
													<span
														class="mt-auto line-clamp-1 text-[11px] opacity-80"
														style:color={t.fg}>{cell.topicName}</span
													>
												{:else}
													<span class="mt-0.5 text-xs italic" style:color={t.fg}>Open Slot</span>
												{/if}
											</div>
										{/if}
									</td>
								{/if}
							{/if}
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="mt-3 text-[11px] text-muted-foreground">
		{variant} — Collapsed column, School Holiday drawn as: {holiday.rule}. A Blocked Day and a
		School Holiday drop their Periods and become one panel, so a day with no teaching cannot be read
		as a day with empty Periods. The Blocked Day panel keeps the hatch, because it is a removal.
	</p>
{:else if variant === 'B'}
	<!-- B — Narrow gutter. A School Holiday is not the school's time, so it gives its width back:
	     the column shrinks to a labelled strip. A Blocked Day keeps full width, because the
	     Periods it removed are the point. -->
	<div class="overflow-x-auto">
		<table class="w-full border-separate border-spacing-1.5">
			<colgroup>
				<col style="width: 3rem" />
				{#each WEEK as day (day.date)}
					<col style={day.kind === 'holiday' ? 'width: 3rem' : ''} />
				{/each}
			</colgroup>
			<thead>
				<tr>
					<th></th>
					{#each WEEK as day (day.date)}
						<th class="pb-1 text-left align-bottom">
							{#if day.kind === 'holiday'}
								<div class="text-xs font-semibold text-muted-foreground">{day.name}</div>
							{:else}
								<div class="flex items-baseline gap-1.5">
									<span class="text-sm font-semibold">{day.name}</span>
									<span class="text-xs font-normal text-muted-foreground">{day.date}</span>
									{#if day.kind === 'blocked'}
										<span
											class="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
											>{day.note} · unblock</span
										>
									{/if}
								</div>
							{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each PERIODS as period (period)}
					<tr>
						<th class="pr-1 text-right align-top">
							<div class="pt-1.5 text-xs font-medium text-muted-foreground tabular-nums">
								P{period}
							</div>
						</th>
						{#each WEEK as day, di (day.date)}
							{#if day.kind === 'holiday'}
								{#if period === 1}
									<td rowspan={6} class="rounded-lg bg-muted/60 align-middle">
										<div class="flex justify-center">
											<span
												class="proto-vertical text-[11px] font-medium tracking-wide text-muted-foreground"
												>{day.note} · {day.date}</span
											>
										</div>
									</td>
								{/if}
							{:else}
								{@const entry = grid[di][period - 1]}
								{#if entry.type === 'covered'}
									<!-- spanned -->
								{:else if entry.type === 'free'}
									<td class="h-16"></td>
								{:else}
									{@const cell = entry.cell}
									<td rowspan={cell.span} class="h-16 align-top">
										{#if cell.kind === 'blocked'}
											<div
												class="flex h-full min-h-16 flex-col justify-center rounded-lg bg-muted/70 px-2 py-1.5"
											>
												<div class="text-xs font-semibold text-muted-foreground line-through">
													{cell.classLabel}
												</div>
												<div class="mt-0.5 text-[11px] text-muted-foreground/80">
													{cell.note ?? 'Blocked'}
												</div>
											</div>
										{:else}
											{@const t = tone(cell)}
											<div
												class="flex h-full min-h-16 flex-col rounded-lg px-2 py-1.5"
												style:background-color={t.bg}
											>
												<span class="truncate text-xs font-semibold" style:color={t.fg}
													>{cell.classLabel}</span
												>
												{#if cell.kind === 'lesson'}
													<span
														class="mt-0.5 line-clamp-2 text-xs leading-tight font-medium"
														style:color={t.fg}>{cell.title}</span
													>
													<span
														class="mt-auto line-clamp-1 text-[11px] opacity-80"
														style:color={t.fg}>{cell.topicName}</span
													>
												{:else}
													<span class="mt-0.5 text-xs italic" style:color={t.fg}>Open Slot</span>
												{/if}
											</div>
										{/if}
									</td>
								{/if}
							{/if}
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="mt-3 text-[11px] text-muted-foreground">
		B — Narrow gutter. A School Holiday gives back its width and reads as a margin of the week. An
		empty Term-time Period is drawn as nothing at all, so the only filled cells are Classes. A
		removal is a grey card with the Class name struck through.
	</p>
{:else if variant === 'C'}
	<!-- C — One surface, no tints. Every day column has the same background. State is carried by
	     the tile alone: solid = a Lesson, outline = an Open Slot, struck grey = removed, absent =
	     no Class. A day off is a full-width band across its column head. -->
	<div class="overflow-x-auto">
		<table class="w-full table-fixed border-separate border-spacing-1.5">
			<thead>
				<tr>
					<th class="w-12"></th>
					{#each WEEK as day (day.date)}
						<th class="pb-1 text-left align-bottom">
							<div class="flex items-baseline gap-1.5">
								<span class="text-sm font-semibold">{day.name}</span>
								<span class="text-xs font-normal text-muted-foreground">{day.date}</span>
							</div>
							{#if day.kind !== 'teaching'}
								<div
									class="mt-1 rounded px-1.5 py-0.5 text-[11px] font-medium {day.kind === 'holiday'
										? 'proto-c-holiday'
										: 'proto-c-blocked'}"
								>
									{day.note}{day.kind === 'blocked' ? ' · unblock' : ''}
								</div>
							{:else}
								<div class="mt-1 h-[1.375rem]"></div>
							{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each PERIODS as period (period)}
					<tr>
						<th class="pr-1 text-right align-top">
							<div class="pt-1.5 text-xs font-medium text-muted-foreground tabular-nums">
								P{period}
							</div>
						</th>
						{#each WEEK as day, di (day.date)}
							{@const entry = grid[di][period - 1]}
							{#if entry.type === 'covered'}
								<!-- spanned -->
							{:else if entry.type === 'free'}
								<td class="h-16 rounded-lg border border-dashed border-border/60"></td>
							{:else}
								{@const cell = entry.cell}
								{@const t = tone(cell)}
								<td rowspan={cell.span} class="h-16 align-top">
									{#if cell.kind === 'blocked'}
										<div
											class="flex h-full min-h-16 flex-col rounded-lg border border-border bg-muted/50 px-2 py-1.5"
										>
											<span
												class="truncate text-xs font-semibold text-muted-foreground line-through"
												>{cell.classLabel}</span
											>
											<span class="mt-0.5 text-[11px] text-muted-foreground/80">
												{day.kind === 'holiday' ? 'Not in Term' : (cell.note ?? 'Blocked')}
											</span>
										</div>
									{:else if cell.kind === 'lesson'}
										<div
											class="flex h-full min-h-16 flex-col rounded-lg px-2 py-1.5"
											style:background-color={t.bg}
										>
											<span class="truncate text-xs font-semibold" style:color={t.fg}
												>{cell.classLabel}</span
											>
											<span
												class="mt-0.5 line-clamp-2 text-xs leading-tight font-medium"
												style:color={t.fg}>{cell.title}</span
											>
											<span class="mt-auto line-clamp-1 text-[11px] opacity-80" style:color={t.fg}
												>{cell.topicName}</span
											>
										</div>
									{:else}
										<div
											class="flex h-full min-h-16 flex-col rounded-lg border-2 px-2 py-1.5"
											style:border-color={t.bg}
										>
											<span class="truncate text-xs font-semibold" style:color={t.ring}
												>{cell.classLabel}</span
											>
											<span class="mt-0.5 text-xs text-muted-foreground italic">Open Slot</span>
										</div>
									{/if}
								</td>
							{/if}
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="mt-3 text-[11px] text-muted-foreground">
		C — One surface. No column wash and no hatch. A Lesson is a filled tile, an Open Slot is the
		same colour as an outline, a removal is grey with the Class struck through, and a Period no
		Class holds is a dashed outline. The day head says why a day is off.
	</p>
{:else}
	<!-- D — Off-days out of the grid. The week grid holds only days that are taught. A Blocked Day
	     and a School Holiday are listed above it, so the grid never has to explain itself. -->
	<div class="mb-3 flex flex-wrap gap-2">
		{#each offDays as day (day.date)}
			<div
				class="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs {day.kind ===
				'holiday'
					? 'border-dashed border-border bg-transparent text-muted-foreground'
					: 'proto-d-blocked border-muted-foreground/25'}"
			>
				<span class="font-semibold">{day.name} {day.date}</span>
				<span class="text-muted-foreground">{day.note}</span>
				{#if day.kind === 'blocked'}
					<button type="button" class="underline underline-offset-2">unblock</button>
				{/if}
			</div>
		{/each}
	</div>
	<div class="overflow-x-auto">
		<table class="w-full table-fixed border-separate border-spacing-1.5">
			<thead>
				<tr>
					<th class="w-12"></th>
					{#each teachingDays as day (day.date)}
						<th class="pb-1 text-left align-bottom">
							<div class="flex items-baseline gap-1.5">
								<span class="text-sm font-semibold">{day.name}</span>
								<span class="text-xs font-normal text-muted-foreground">{day.date}</span>
							</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each PERIODS as period (period)}
					<tr>
						<th class="pr-1 text-right align-top">
							<div class="pt-1.5 text-xs font-medium text-muted-foreground tabular-nums">
								P{period}
							</div>
						</th>
						{#each teachingDays as day, di (day.date)}
							{@const entry = teachingGrid[di][period - 1]}
							{#if entry.type === 'covered'}
								<!-- spanned -->
							{:else if entry.type === 'free'}
								<td class="h-16 rounded-lg bg-muted/40"></td>
							{:else}
								{@const cell = entry.cell}
								{@const t = tone(cell)}
								<td rowspan={cell.span} class="h-16 align-top">
									{#if cell.kind === 'blocked'}
										<div
											class="proto-d-blocked flex h-full min-h-16 flex-col rounded-lg px-2 py-1.5"
										>
											<span class="truncate text-xs font-semibold text-muted-foreground"
												>{cell.classLabel}</span
											>
											<span class="mt-0.5 text-xs text-muted-foreground/80 italic"
												>{cell.note ?? 'Blocked'}</span
											>
											<button
												type="button"
												class="mt-auto self-start text-[11px] text-muted-foreground underline underline-offset-2"
												>Unblock</button
											>
										</div>
									{:else}
										<div
											class="flex h-full min-h-16 flex-col rounded-lg px-2 py-1.5"
											style:background-color={t.bg}
										>
											<span class="truncate text-xs font-semibold" style:color={t.fg}
												>{cell.classLabel}</span
											>
											{#if cell.kind === 'lesson'}
												<span
													class="mt-0.5 line-clamp-2 text-xs leading-tight font-medium"
													style:color={t.fg}>{cell.title}</span
												>
												<span class="mt-auto line-clamp-1 text-[11px] opacity-80" style:color={t.fg}
													>{cell.topicName}</span
												>
											{:else}
												<span class="mt-0.5 text-xs italic" style:color={t.fg}>Open Slot</span>
											{/if}
										</div>
									{/if}
								</td>
							{/if}
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="mt-3 text-[11px] text-muted-foreground">
		D — Off-days out of the grid. Only days that are taught get a column, so a three-day week looks
		like a three-day week. The days that are off are named above it, a Blocked Day hatched and a
		School Holiday plain.
	</p>
{/if}

<style>
	.proto-a-blocked,
	.proto-d-blocked {
		background-image: repeating-linear-gradient(
			135deg,
			color-mix(in oklab, var(--muted-foreground) 14%, transparent) 0 5px,
			transparent 5px 10px
		);
	}

	/* A1 — a warm tint, the Holiday's own colour, well clear of the grey empty Period. */
	.proto-hol-warm {
		background-color: color-mix(in oklab, var(--warning-bg) 85%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--warning-ring) 35%, transparent);
	}

	.proto-hol-warm :global(.proto-hol-icon) {
		color: var(--warning-fg);
	}

	.proto-hol-warm-head {
		color: var(--warning-fg);
	}

	/* A2 — no colour: the same grey as an empty Period, taken far enough down that it reads as a
	   solid block rather than an empty cell. The step in shade is the whole distinction. */
	.proto-hol-solid {
		background-color: color-mix(in oklab, var(--muted-foreground) 16%, transparent);
	}

	.proto-hol-solid :global(.proto-hol-icon) {
		color: var(--muted-foreground);
		opacity: 0.7;
	}

	/* A3 — the other direction: the Holiday holds nothing at all, so the page shows through and
	   only a rule marks where the week stops. Emptier than an empty Period, not fuller. */
	.proto-hol-void {
		background-color: transparent;
		border-left: 2px dashed color-mix(in oklab, var(--muted-foreground) 35%, transparent);
	}

	.proto-hol-void :global(.proto-hol-icon) {
		color: var(--muted-foreground);
		opacity: 0.5;
	}

	.proto-vertical {
		writing-mode: vertical-rl;
		transform: rotate(180deg);
	}

	.proto-c-holiday {
		background-color: color-mix(in oklab, var(--warning-bg) 60%, transparent);
		color: var(--muted-foreground);
	}

	.proto-c-blocked {
		background-color: color-mix(in oklab, var(--muted-foreground) 12%, transparent);
		color: var(--muted-foreground);
	}
</style>
