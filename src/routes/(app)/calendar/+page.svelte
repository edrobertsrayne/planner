<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import BanIcon from '@lucide/svelte/icons/ban';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { classTone } from '$lib/class-tone';
	import { formatDayMonth } from '$lib/date';
	import { refresh } from '$lib/client/enhance';
	import { openSession } from '$lib/client/session-panel.svelte';
	import AtRiskAlert from '$lib/components/at-risk-alert.svelte';
	import AtRiskReport from '$lib/components/at-risk-report.svelte';
	import { Button } from '$lib/components/ui/button';
	import PageHeader from '$lib/components/page-header.svelte';
	import BlockPopover from './BlockPopover.svelte';
	import CalendarSetup from './CalendarSetup.svelte';
	import { PERIODS, toGrid } from './calendar-grid';
	import type { DayKind } from '$lib/server/planner';
	import type { PageProps } from './$types';
	// PROTOTYPE — throwaway. ?variant=A|B|C|D swaps the week grid for the state-distinction
	// variants. Remove this import, the two below it and the `{#if prototypeVariant}` branch
	// with PrototypeStates.svelte.
	import { page } from '$app/state';
	import PrototypeStates from './PrototypeStates.svelte';
	import PrototypeSwitcher from './PrototypeSwitcher.svelte';

	let { data, form }: PageProps = $props();

	// PROTOTYPE — throwaway.
	const PROTO_VARIANTS = ['A2', 'A1', 'A3'];
	const PROTO_NAMES: Record<string, string> = {
		A2: 'Holiday — solid panel',
		A1: 'Holiday — warm tint',
		A3: 'Holiday — empty, ruled off',
		B: 'Narrow gutter',
		C: 'One surface',
		D: 'Off-days out of the grid'
	};
	const prototypeVariant = $derived.by(() => {
		if (!import.meta.env.DEV) return null;
		const v = page.url.searchParams.get('variant')?.toUpperCase();
		return v && (PROTO_VARIANTS.includes(v) || ['B', 'C', 'D'].includes(v)) ? v : null;
	});

	// Setup mode replaces the week grid in place, on the same route. It opens by itself when no
	// Term is set — the first-run empty state of the year — and closing lands on the week the
	// teacher was on, because opening it never navigated away. Opening by itself is a
	// first-render fact, not a live one: a later load must not force the mode open or shut.
	// svelte-ignore state_referenced_locally
	let setup = $state(data.terms.length === 0);

	// The save's report, narrowed once: what the Rewind put at risk, or the plain statement that
	// it put nothing at risk — silence would be ambiguous. ActionData is a loose record, so the
	// narrowing lives here rather than in the markup.
	const savedYear = $derived(form && 'yearSaved' in form ? { atRisk: form.atRisk ?? [] } : null);

	const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

	// The ribbon and the two arrows all step the year by query string. `prev`, `next` and a ribbon
	// entry each carry a week commencing date, not a URL, so the link is built here.
	const weekHref = (weekCommencing: string) => resolve(`/calendar?week=${weekCommencing}`);

	// One entry per (day, Period); see calendar-grid.ts. The explicit `h-16` on a start cell's
	// <td> is what lets the tile's `h-full` resolve, so a multi-Period Lesson renders as one tall
	// tile rather than silently collapsing to one Period.
	const grid = $derived.by(() => toGrid(data.week?.days ?? [], data.week?.cells ?? []));
	const blockedByDate = $derived(new Map((data.week?.blockedDays ?? []).map((b) => [b.date, b])));

	// The column's state as a class: a wash on the header and every cell behind the tiles, so
	// the day itself reads as one state. A teaching day takes none.
	const kindClass = (kind: DayKind | undefined) =>
		kind === 'holiday' ? 'day-holiday' : kind === 'blocked' ? 'day-blocked' : '';
</script>

<svelte:head><title>Calendar</title></svelte:head>

<div class="mx-auto max-w-6xl px-6 py-6">
	<PageHeader title="Calendar" description="One Teaching Week, Periods against days.">
		{#snippet actions()}
			<!-- Save year and Cancel sit in the setup mode's own header: the week controls here
			     would read a year that is not saved yet. -->
			{#if !setup}
				{#if data.week}
					<div class="flex items-center gap-2">
						<Button
							variant="ghost"
							size="icon-sm"
							href={data.prev ? weekHref(data.prev) : undefined}
							disabled={!data.prev}
							aria-label="Previous Teaching Week"
						>
							<ChevronLeftIcon />
						</Button>

						<div class="flex items-center gap-0.5 rounded-md border p-0.5">
							{#each data.ribbon as w (w.weekCommencing)}
								{@const isSelected = w.weekCommencing === data.selected}
								<a
									href={weekHref(w.weekCommencing)}
									aria-current={isSelected ? 'true' : undefined}
									class="flex h-6 items-center rounded-sm px-2 text-xs font-medium tabular-nums {isSelected
										? 'bg-secondary text-secondary-foreground'
										: 'text-muted-foreground hover:bg-muted'}"
									title="w/c {formatDayMonth(w.weekCommencing)}"
								>
									{w.letter}<span class="ml-1 font-normal opacity-70"
										>{formatDayMonth(w.weekCommencing)}</span
									>
								</a>
							{/each}
						</div>

						<Button
							variant="ghost"
							size="icon-sm"
							href={data.next ? weekHref(data.next) : undefined}
							disabled={!data.next}
							aria-label="Next Teaching Week"
						>
							<ChevronRightIcon />
						</Button>
					</div>
				{/if}

				<Button size="sm" class="h-7" onclick={() => (setup = true)}>Set up year</Button>
			{/if}
		{/snippet}
	</PageHeader>

	{#if savedYear}
		<AtRiskReport
			atRisk={savedYear.atRisk}
			none="The year is saved. No Sessions were put at risk."
			class="mb-4 text-sm"
		/>
	{:else if form?.atRisk}
		<AtRiskAlert atRisk={form.atRisk} />
	{/if}

	<!-- PROTOTYPE — throwaway branch. -->
	{#if prototypeVariant}
		<PrototypeStates variant={prototypeVariant} />
		<PrototypeSwitcher variants={PROTO_VARIANTS} names={PROTO_NAMES} current={prototypeVariant} />
	{:else if setup}
		<CalendarSetup
			terms={data.terms}
			blockedDays={data.blockedDays}
			onclose={() => (setup = false)}
		/>
	{:else if data.ribbon.length === 0}
		<p class="text-sm text-muted-foreground">No Teaching Weeks are set up yet.</p>
	{:else if data.week}
		<div class="overflow-x-auto">
			<table class="w-full table-fixed border-separate border-spacing-1.5">
				<thead>
					<tr>
						<th class="w-12"></th>
						{#each DAY_NAMES as d, di (d)}
							{@const date = data.week.days[di].date}
							{@const blockedDay = blockedByDate.get(date)}
							{@const dayKind = data.week.days[di].kind}
							<th
								class="rounded-lg pb-1 text-left align-bottom {kindClass(dayKind)}"
								data-day-kind={dayKind}
							>
								<div class="flex items-baseline gap-1.5">
									<span class="text-sm font-semibold">{d}</span>
									<span class="text-xs font-normal text-muted-foreground"
										>{formatDayMonth(date)}</span
									>
									{#if blockedDay}
										<form method="POST" action="?/unblockDay" class="ml-auto" use:enhance={refresh}>
											<input type="hidden" name="date" value={blockedDay.date} />
											<Button
												type="submit"
												variant="ghost"
												size="xs"
												title={blockedDay.note ?? 'Blocked day'}
											>
												blocked · unblock
											</Button>
										</form>
									{:else}
										<BlockPopover
											contentClass="w-64 p-3"
											triggerClass="ml-auto rounded px-1 text-xs font-normal text-muted-foreground/50 hover:text-foreground focus-visible:text-foreground"
											action="?/blockDay"
											fields={{ date }}
											label={`Block ${d} ${formatDayMonth(date)}`}
											noteRequired={false}
										>
											{#snippet trigger()}Block day{/snippet}
										</BlockPopover>
									{/if}
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
							{#each DAY_NAMES as d, di (d)}
								{@const dayKind = data.week.days[di].kind}
								{@const entry = grid[di][period - 1]}
								{#if entry.type === 'covered'}
									<!-- covered by an earlier Period's rowspan -->
								{:else if entry.type === 'free'}
									<td
										class="h-16 rounded-lg {kindClass(dayKind) || 'bg-muted/40'}"
										data-day-kind={dayKind}
									></td>
								{:else}
									{@const cell = entry.cell}
									{@const rowspan = cell.periodTo - cell.periodFrom + 1}
									{@const tone = classTone(cell.tone)}
									<td
										{rowspan}
										class="group/cell relative h-16 align-top {kindClass(dayKind)}"
										data-day-kind={dayKind}
									>
										{#if cell.kind === 'blocked'}
											<!-- A School Holiday removes nothing, so its tile is plain — label
											only, the header's unblock button carrying any Blocked Day entered
											on it. A Blocked Slot recorded on a holiday is a removal all the
											same, so it keeps the hatch, its note and its unblock link. -->
											{@const plainHoliday = dayKind === 'holiday' && !cell.blockedSlotId}
											<div
												class="flex h-full min-h-16 flex-col rounded-lg px-2 py-1.5 {plainHoliday
													? 'holiday-tile'
													: 'hatched border border-dashed'}"
											>
												<div class="text-xs font-semibold text-muted-foreground">
													{cell.classLabel}
												</div>
												{#if !plainHoliday}
													<div class="mt-0.5 line-clamp-2 text-xs text-muted-foreground/80 italic">
														{cell.blockedNote ?? 'Blocked'}
													</div>
													{#if cell.blockedSlotId || cell.blockedDayId}
														<form
															method="POST"
															action={cell.blockedSlotId ? '?/unblockSlot' : '?/unblockDay'}
															class="mt-auto self-start"
															use:enhance={refresh}
														>
															<input
																type="hidden"
																name={cell.blockedSlotId ? 'id' : 'date'}
																value={cell.blockedSlotId ?? cell.date}
															/>
															<Button
																type="submit"
																variant="link"
																size="xs"
																class="h-auto px-0 text-muted-foreground underline underline-offset-2"
															>
																{cell.blockedSlotId ? 'Unblock' : 'Unblock day'}
															</Button>
														</form>
													{/if}
												{/if}
											</div>
										{:else}
											<button
												type="button"
												data-session-trigger
												class="relative flex h-full min-h-16 w-full flex-col overflow-hidden rounded-lg border px-2 py-1.5 text-left hover:brightness-95"
												style:background-color={tone.bg}
												style:border-color={tone.ring}
												onclick={() =>
													openSession({
														classId: cell.classId,
														date: cell.date,
														period: cell.periodFrom
													})}
											>
												<span class="truncate text-xs font-semibold" style:color={tone.fg}>
													{cell.classLabel}
												</span>
												{#if cell.kind === 'lesson'}
													<span
														class="mt-0.5 line-clamp-2 text-xs leading-tight font-medium"
														style:color={tone.fg}>{cell.lesson?.title}</span
													>
													{#if cell.lesson?.topicName}
														<span
															class="mt-auto line-clamp-1 text-[11px] opacity-80"
															style:color={tone.fg}>{cell.lesson.topicName}</span
														>
													{/if}
												{:else}
													<span class="mt-0.5 text-xs italic" style:color={tone.fg}>
														Open Slot
													</span>
												{/if}
											</button>

											{#if cell.periodFrom === cell.periodTo}
												<!-- A Lesson with Length > 1 spans several Periods as one merged
												cell; a Blocked Slot is only ever one Period, so the control is offered
												solely on a cell that is exactly one Period wide, never on a span where
												"this Period" would be ambiguous. -->
												<BlockPopover
													contentClass="w-64 p-3"
													triggerClass="absolute top-1 right-1 rounded-sm bg-background/70 p-0.5 text-muted-foreground opacity-0 group-hover/cell:opacity-100 focus-visible:opacity-100 hover:text-foreground"
													triggerLabel={`Block ${cell.classLabel}, P${cell.periodFrom}`}
													action="?/blockSlot"
													fields={{ classId: cell.classId, date: cell.date, slotId: cell.slotId }}
													label={`Block ${cell.classLabel}, P${cell.periodFrom}`}
													noteRequired={true}
												>
													{#snippet trigger()}<BanIcon class="size-3" />{/snippet}
												</BlockPopover>
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
		<p class="mt-3 text-[11px] text-muted-foreground">
			Grey hatch = removed — a Blocked Day or a Blocked Slot. Amber = School Holiday — a date
			outside every Term. Coloured with no Lesson = Open Slot — the Class is taught, nothing is
			planned for it yet. An empty cell is a Period no Class holds. Click any tile to open its
			Session.
		</p>
	{:else}
		<p class="text-sm text-muted-foreground">This is not a Teaching Week.</p>
	{/if}
</div>

<style>
	/*
		A Blocked Day and a Blocked Slot drain the colour instead of keeping it (CONTEXT.md,
		Calendar): present-but-empty and removed must never read alike. The same texture derived
		from --muted-foreground reads in both themes with no dark-mode branch — replacing the two
		hardcoded near-whites the old hatch used — and replaces the tone rather than sitting over
		it, so removed never reads like empty.

		A School Holiday is a third state, not a removal: the Term is not running, so nothing was
		taken away. Its tint comes from --warning-bg, which the feedback tokens define for both
		themes, so it too needs no dark-mode branch. The washes sit on the day column — header and
		cells alike — so the day itself reads as one state, hatch and tint never mixing.
	*/
	.hatched {
		background-image: repeating-linear-gradient(
			135deg,
			color-mix(in oklab, var(--muted-foreground) 14%, transparent) 0 5px,
			transparent 5px 10px
		);
	}

	/* The day-column washes: quiet enough to sit behind tiles, present enough to read at a
	   glance. The grey deepens the hatch the blocked state already owns. */
	.day-blocked {
		background-color: color-mix(in oklab, var(--muted-foreground) 8%, transparent);
	}

	.day-holiday {
		background-color: color-mix(in oklab, var(--warning-bg) 35%, transparent);
	}

	/* The holiday tile is one step deeper than its column wash — that step, not a border, is
	   what separates it from the free cell it sits among. */
	.holiday-tile {
		background-color: color-mix(in oklab, var(--warning-bg) 45%, transparent);
	}
</style>
