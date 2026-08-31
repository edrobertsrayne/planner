<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import { classTone } from '$lib/class-tone';
	import { formatDayMonth } from '$lib/date';
	import { refresh, submitWithValue } from '$lib/client/enhance';
	import { openSession } from '$lib/client/session-panel.svelte';
	import AtRiskAlert from '$lib/components/at-risk-alert.svelte';
	import AtRiskReport from '$lib/components/at-risk-report.svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import PageHeader from '$lib/components/page-header.svelte';
	import BlockPopover from './BlockPopover.svelte';
	import CalendarSetup from './CalendarSetup.svelte';
	import { blockableSlots, blockedSlotLines, PERIODS, toGrid } from './calendar-grid';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

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

	// The Slot the day menu picked to block, whose note is asked for over its tile. Rendering
	// the popover only while a pick is open is the whole of the opening gesture: the menu
	// chooses, the popover asks.
	let slotNote = $state<{ date: string; slotId: string; period: number } | null>(null);

	// A pick names a Slot in the week's data, so it dies when the week it names is no longer
	// the one shown — a navigation, or a week with no grid. Clearing on every change of the
	// week's data would drop the pick mid-refusal: the block popover reloads the week before
	// it reads the answer, and a refused note would be discarded with the form. A week
	// navigated away from and back to must not reopen the note form by itself.
	$effect(() => {
		const picked = slotNote;
		if (picked && !data.week?.days.some((d) => d.date === picked.date)) slotNote = null;
	});

	// The day head's menu acts through three hidden forms rather than one per day: a Blocked Day
	// records no cause, so blocking it is a single click with no field to fill, and the same form
	// serves every day. `submitWithValue` sets the field and submits, so a menu item's onSelect is
	// the whole of the wiring.
	let blockDayForm = $state<HTMLFormElement | undefined>();
	let unblockDayForm = $state<HTMLFormElement | undefined>();
	let unblockSlotForm = $state<HTMLFormElement | undefined>();

	function blockDay(date: string) {
		submitWithValue(blockDayForm, 'date', date);
	}

	function unblockDay(date: string) {
		submitWithValue(unblockDayForm, 'date', date);
	}

	function unblockSlot(id: string) {
		submitWithValue(unblockSlotForm, 'id', id);
	}
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

	{#if setup}
		<CalendarSetup
			terms={data.terms}
			blockedDays={data.blockedDays}
			onclose={() => (setup = false)}
		/>
	{:else if data.ribbon.length === 0}
		<p class="text-sm text-muted-foreground">No Teaching Weeks are set up yet.</p>
	{:else if data.week}
		<!-- Three hidden forms serve every day's menu: the field they carry is set immediately
		     before each submits, so one of each is enough regardless of how many days or Blocked
		     Slots the week holds. -->
		<form
			bind:this={blockDayForm}
			method="POST"
			action="?/blockDay"
			use:enhance={refresh}
			class="hidden"
		>
			<input type="hidden" name="date" />
		</form>
		<form
			bind:this={unblockDayForm}
			method="POST"
			action="?/unblockDay"
			use:enhance={refresh}
			class="hidden"
		>
			<input type="hidden" name="date" />
		</form>
		<form
			bind:this={unblockSlotForm}
			method="POST"
			action="?/unblockSlot"
			use:enhance={refresh}
			class="hidden"
		>
			<input type="hidden" name="id" />
		</form>

		<div class="overflow-x-auto">
			<table class="w-full table-fixed border-separate border-spacing-1.5">
				<thead>
					<tr>
						<th class="w-12"></th>
						{#each DAY_NAMES as d, di (d)}
							{@const date = data.week.days[di].date}
							{@const blockedDay = blockedByDate.get(date)}
							{@const dayKind = data.week.days[di].kind}
							{@const blockedSlots = blockedSlotLines(data.week.cells, date)}
							<th class="rounded-lg pb-1 text-left align-bottom" data-day-kind={dayKind}>
								<div class="flex items-baseline gap-1.5">
									<span class="text-sm font-semibold">{d}</span>
									<span class="text-xs font-normal text-muted-foreground"
										>{formatDayMonth(date)}</span
									>
									<DropdownMenu.Root>
										<DropdownMenu.Trigger
											class="ml-auto rounded px-0.5 text-muted-foreground/50 hover:text-foreground [&_svg]:size-4"
											aria-label={`${d} ${formatDayMonth(date)} actions`}
										>
											<EllipsisIcon />
										</DropdownMenu.Trigger>
										<DropdownMenu.Content class="w-60" align="end">
											<DropdownMenu.Group>
												{#if blockedDay}
													<DropdownMenu.Item onSelect={() => unblockDay(blockedDay.date)}
														>Unblock day</DropdownMenu.Item
													>
												{:else}
													<DropdownMenu.Item onSelect={() => blockDay(date)}
														>Block day</DropdownMenu.Item
													>
												{/if}
											</DropdownMenu.Group>
											{#if dayKind === 'teaching'}
												{@const blockable = blockableSlots(data.week.cells, date)}
												{#if blockable.length > 0}
													<DropdownMenu.Separator />
													<DropdownMenu.Group>
														<DropdownMenu.GroupHeading class="text-muted-foreground"
															>Block one Slot</DropdownMenu.GroupHeading
														>
														<!-- One line per real Slot, so a Lesson over two Periods appears
													     twice. Picking one opens the note form over its tile. -->
														{#each blockable as slot (slot.slotId)}
															<DropdownMenu.Item
																onSelect={() =>
																	(slotNote = {
																		date,
																		slotId: slot.slotId,
																		period: slot.period
																	})}>{slot.classLabel}, P{slot.period}…</DropdownMenu.Item
															>
														{/each}
													</DropdownMenu.Group>
												{/if}
											{/if}
											{#if blockedSlots.length > 0}
												<DropdownMenu.Separator />
												<DropdownMenu.Group>
													<DropdownMenu.GroupHeading class="text-muted-foreground"
														>Blocked Slots</DropdownMenu.GroupHeading
													>
													{#each blockedSlots as slot (slot.blockedSlotId)}
														<DropdownMenu.Item onSelect={() => unblockSlot(slot.blockedSlotId)}
															>Unblock {slot.classLabel}, P{slot.period}</DropdownMenu.Item
														>
													{/each}
												</DropdownMenu.Group>
											{/if}
										</DropdownMenu.Content>
									</DropdownMenu.Root>
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
								{@const date = data.week.days[di].date}
								{@const dayKind = data.week.days[di].kind}
								{#if dayKind !== 'teaching'}
									<!-- A day with no teaching drops its six Periods and reads as one panel
									     spanning the column, told apart from an empty Period by a step in
									     shade — hatched grey for a removal, a solid step for a School Holiday
									     where nothing was removed — never by a hue. -->
									{#if period === 1}
										{@const blockedDay = blockedByDate.get(date)}
										{@const headline =
											dayKind === 'holiday'
												? 'School holiday'
												: (blockedDay?.note ?? 'Blocked day')}
										{@const under = dayKind === 'holiday' ? 'Outside every Term' : 'No teaching'}
										<td rowspan={PERIODS.length} class="h-16 align-middle" data-day-kind={dayKind}>
											<div
												class={cn(
													'flex h-full flex-col items-center justify-center gap-1 rounded-lg px-2 py-3 text-center',
													dayKind === 'holiday'
														? 'day-panel-holiday'
														: 'hatched border border-dashed border-muted-foreground/30'
												)}
											>
												<div class="text-xs font-semibold text-muted-foreground">{headline}</div>
												<div class="text-[11px] text-muted-foreground/70">{under}</div>
											</div>
										</td>
									{/if}
								{:else}
									{@const entry = grid[di][period - 1]}
									{#if entry.type === 'covered'}
										<!-- covered by an earlier Period's rowspan -->
									{:else if entry.type === 'free'}
										<td class="h-16 rounded-lg bg-muted/40"></td>
									{:else}
										{@const cell = entry.cell}
										{@const rowspan = cell.periodTo - cell.periodFrom + 1}
										{@const tone = classTone(cell.tone)}
										<td {rowspan} class="relative h-16 align-top">
											{#if cell.kind === 'blocked'}
												<!-- A Blocked Slot on an otherwise teaching day: a removal, so it keeps
											the hatch and its note. Its unblock lives in the day's menu, like every
											other act on the day — no control sits on a tile. -->
												<div
													class="hatched flex h-full min-h-16 flex-col rounded-lg border border-dashed px-2 py-1.5"
												>
													<div class="text-xs font-semibold text-muted-foreground">
														{cell.classLabel}
													</div>
													<div class="mt-0.5 line-clamp-2 text-xs text-muted-foreground/80 italic">
														{cell.blockedNote ?? 'Blocked'}
													</div>
												</div>
											{:else}
												<button
													type="button"
													data-session-trigger
													class="flex h-full min-h-16 w-full flex-col overflow-hidden rounded-lg border px-2 py-1.5 text-left"
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

												{#if slotNote && slotNote.date === cell.date && cell.slotIds.includes(slotNote.slotId)}
													<!-- The day menu chose this Slot; the note is asked for over the tile
												it names, so the teacher can see which one they picked. For a Lesson
												over two Periods both lines open the same tile, each naming its own. -->
													<BlockPopover
														label={`Block ${cell.classLabel}, P${slotNote.period}`}
														action="?/blockSlot"
														fields={{
															classId: cell.classId,
															date: cell.date,
															slotId: slotNote.slotId
														}}
														onOpenChange={(o) => {
															if (!o) slotNote = null;
														}}
													/>
												{/if}
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
	{:else}
		<p class="text-sm text-muted-foreground">This is not a Teaching Week.</p>
	{/if}
</div>

<style>
	/*
		A Blocked Day and a Blocked Slot drain the colour instead of keeping it (CONTEXT.md,
		Calendar): present-but-empty and removed must never read alike. The same texture derived
		from --muted-foreground reads in both themes with no dark-mode branch, and replaces the
		tone rather than sitting over it, so removed never reads like empty.
	*/
	.hatched {
		background-image: repeating-linear-gradient(
			135deg,
			color-mix(in oklab, var(--muted-foreground) 14%, transparent) 0 5px,
			transparent 5px 10px
		);
	}

	/* A School Holiday is not a removal — nothing was taken away, the school is simply not
	   running — so its panel takes no hatch, only a step in shade deep enough to read as a solid
	   block rather than an empty Period. No hue: the same grey the hatch is built from. */
	.day-panel-holiday {
		background-color: color-mix(in oklab, var(--muted-foreground) 16%, transparent);
	}
</style>
