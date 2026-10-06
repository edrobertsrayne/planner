<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import { classTone } from '$lib/class-tone';
	import { formatDayMonth } from '$lib/date';
	import { refresh } from '$lib/client/enhance';
	import { sessionHref } from '$lib/client/session-href';
	import AtRiskAlert from '$lib/components/at-risk-alert.svelte';
	import AtRiskReport from '$lib/components/at-risk-report.svelte';
	import PlacementsMovedAlert from '$lib/components/placements-moved-alert.svelte';
	import { Button } from '$lib/components/ui/button';
	import { touchTarget } from '$lib/components/ui/touch-target';
	import { cn } from '$lib/utils.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import PageHeader from '$lib/components/page-header.svelte';
	import BlockNoteDialog from './BlockNoteDialog.svelte';
	import CalendarSetup from './CalendarSetup.svelte';
	import {
		availableSlotLines,
		blockedSlotLines,
		PERIODS,
		toGrid,
		type AvailableSlotLine
	} from './calendar-grid';
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
	const savedYear = $derived(
		form && 'yearSaved' in form
			? { atRisk: form.atRisk ?? [], placementsMoved: form.placementsMoved ?? [] }
			: null
	);

	const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

	// The ribbon, the two arrows and Today all navigate by query string. Each carries a week
	// commencing date, not a URL, so the link is built here.
	const weekHref = (weekCommencing: string) => resolve(`/calendar?week=${weekCommencing}`);

	function openToPlace(classId: string, date: string, period: number) {
		return goto(sessionHref({ classId, date, period }));
	}

	// One entry per (day, Period); see calendar-grid.ts. The explicit `h-16` on a start cell's
	// <td> is what lets the tile's `h-full` resolve, so a multi-Period Lesson renders as one tall
	// tile rather than silently collapsing to one Period.
	const grid = $derived.by(() => toGrid(data.week?.days ?? [], data.week?.cells ?? []));
	const blockedByDate = $derived(new Map((data.week?.blockedDays ?? []).map((b) => [b.date, b])));

	// The Slot the day menu picked to block, whose note is asked for in a dialog. The dialog
	// is mounted once and opens through the bound pick, the way ConfirmDeleteDialog is.
	let slotNote = $state<(AvailableSlotLine & { date: string }) | null>(null);

	// A pick names a Slot in the week's data, so it dies when the week it names is no longer
	// the one shown — a navigation, or a week with no grid. Clearing on every change of the
	// week's data would drop the pick mid-refusal: the dialog's form reloads the week before
	// it reads the answer, and a refused note would be discarded with the form. A week
	// navigated away from and back to must not reopen the note form by itself.
	$effect(() => {
		const picked = slotNote;
		if (picked && !data.week?.days.some((d) => d.date === picked.date)) slotNote = null;
	});

	// The day head's menu acts through one hidden form rather than three: a Blocked Day records
	// no cause, so every act the menu offers is a single click, and the form's action and its
	// one field are set beside the value the moment a menu item names them.
	let dayMenuForm = $state<HTMLFormElement | undefined>();
	let dayMenuField = $state<HTMLInputElement | undefined>();

	function dayMenuAct(action: string, field: string, value: string) {
		const form = dayMenuForm;
		const input = dayMenuField;
		if (!form || !input) return;
		form.action = action;
		input.name = field;
		input.value = value;
		form.requestSubmit();
	}
</script>

<svelte:head><title>Calendar</title></svelte:head>

<div class="mx-auto max-w-6xl px-6 py-6">
	<PageHeader>
		<!-- The top bar names the screen on a phone, so below `md` the heading is out of sight (a
	     screen reader still reads it) — the layout the prototype of issue #344 points to, as on
	     the Agenda (issue #342). -->
		<h1 class="sr-only text-lg font-semibold tracking-tight md:not-sr-only">Calendar</h1>
		{#snippet actions()}
			<!-- Save year and Cancel sit in the setup mode's own header: the week controls here
			     would read a year that is not saved yet. -->
			{#if !setup}
				{#if data.week}
					<!-- One row for both sizes, the size choosing what shows and where (stories 102
					     and 103). The DOM order is the `md` order — arrows around the ribbon, Today
					     beside the first arrow — so the keyboard path follows what a laptop shows.
					     Below `md` the arrows frame one label — the week's letter and its Monday —
					     with Today beside them: `max-md:order` moves the label between the arrows
					     and Today to the end. Each control exists once, so no name is doubled in the
					     accessibility tree. -->
					<div class="flex min-w-0 items-center gap-1 md:gap-2">
						<Button
							variant="ghost"
							size="icon-sm"
							class="max-md:order-1"
							href={data.prev ? weekHref(data.prev) : undefined}
							disabled={!data.prev}
							aria-label="Previous Teaching Week"
						>
							<ChevronLeftIcon />
						</Button>

						<!-- Today is the header's main action once the year exists; until then the week
					     controls do not render at all and setting the year keeps the emphasis. While
					     already on the week it would return to it stands down, a disabled button
					     without an href. -->
						<Button
							size="sm"
							class="h-7 max-md:order-4"
							href={data.current && data.selected !== data.current
								? weekHref(data.current)
								: undefined}
							disabled={data.selected === data.current}
						>
							Today
						</Button>

						<!-- The week ribbon is the one row that must fit beside the arrows and Today. It
						     shrinks and scrolls inside itself — the chip-row rule the Agenda and
						     Planning follow — so the page never scrolls sideways (issue #343). -->
						<div
							class="hidden max-w-full items-center gap-0.5 overflow-x-auto rounded-md border p-0.5 md:flex"
						>
							{#each data.ribbon as w (w.weekCommencing)}
								{@const isSelected = w.weekCommencing === data.selected}
								<a
									href={weekHref(w.weekCommencing)}
									aria-current={isSelected ? 'true' : undefined}
									class="flex h-6 shrink-0 items-center rounded-sm px-2 text-xs font-medium tabular-nums {isSelected
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
							class="max-md:order-3"
							href={data.next ? weekHref(data.next) : undefined}
							disabled={!data.next}
							aria-label="Next Teaching Week"
						>
							<ChevronRightIcon />
						</Button>

						<span
							class="min-w-0 flex-1 truncate text-center text-sm font-medium tabular-nums max-md:order-2 md:hidden"
						>
							Week {data.week.letter} · w/c {formatDayMonth(data.week.weekCommencing)}
						</span>
					</div>
				{/if}

				<!-- On a phone the year is not written, so Set up year is out below `md` (story
				     105). -->
				<Button
					size="sm"
					class="hidden h-7 md:inline-flex"
					variant={data.terms.length === 0 ? 'default' : 'ghost'}
					onclick={() => (setup = true)}
				>
					Set up year
				</Button>
			{/if}
		{/snippet}
	</PageHeader>

	{#if savedYear}
		<AtRiskReport
			atRisk={savedYear.atRisk}
			none="The year is saved. No Sessions were put at risk."
			class="mb-4 text-sm"
		/>
		<PlacementsMovedAlert placementsMoved={savedYear.placementsMoved} />
	{:else}
		{#if form?.atRisk}
			<AtRiskAlert atRisk={form.atRisk} />
		{/if}
		{#if form?.placementsMoved}
			<PlacementsMovedAlert placementsMoved={form.placementsMoved} />
		{/if}
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
		<!-- One hidden form serves every day's menu: its action and its one field are set beside
		     the value the moment a menu item names them, so one of each is enough no matter how
		     many days or Blocked Slots the week holds. -->
		<form bind:this={dayMenuForm} method="POST" use:enhance={refresh} class="hidden">
			<input bind:this={dayMenuField} type="hidden" />
		</form>

		<table class="w-full table-fixed border-separate border-spacing-1 md:border-spacing-1.5">
			<thead>
				<tr>
					<th class="w-6 md:w-12"></th>
					{#each DAY_NAMES as d, di (d)}
						{@const date = data.week.days[di].date}
						{@const blockedDay = blockedByDate.get(date)}
						{@const dayKind = data.week.days[di].kind}
						{@const blockedSlots = blockedSlotLines(data.week.cells, date)}
						<th class="rounded-lg pb-1 text-left align-bottom" data-day-kind={dayKind}>
							<div class="flex items-baseline gap-1.5">
								<!-- On a phone a head reads a letter and a date ("M 5"), so the five day
									     columns fit the width; the day name and the month date return from
									     `md`. The wrapper spans own the visibility at each size. -->
								<span class="text-sm font-semibold">
									<span class="md:hidden">{d.slice(0, 1)}</span>
									<span class="hidden md:inline">{d}</span>
								</span>
								<span class="text-xs font-normal text-muted-foreground">
									<span class="md:hidden">{Number(date.slice(8))}</span>
									<span class="hidden md:inline">{formatDayMonth(date)}</span>
								</span>
								<!-- The day menu writes the calendar, so it is out below `md` (story 105):
									     a hidden subtree is out of the accessibility tree, and no trigger
									     means no menu. -->
								<DropdownMenu.Root>
									<!-- The 44 px target on touch comes from the shared pointer rule, the same
									     as the Course page's own day-menu trigger. -->
									<DropdownMenu.Trigger
										id={`day-menu-${date}`}
										class="{touchTarget} ml-auto hidden rounded px-0.5 text-muted-foreground/50 hover:text-foreground md:inline-flex [&_svg]:size-4"
										aria-label={`${d} ${formatDayMonth(date)} actions`}
									>
										<EllipsisIcon />
									</DropdownMenu.Trigger>
									<DropdownMenu.Content class="w-60" align="end">
										<DropdownMenu.Group>
											{#if blockedDay}
												<DropdownMenu.Item
													onSelect={() => dayMenuAct('?/unblockDay', 'date', blockedDay.date)}
													>Unblock day</DropdownMenu.Item
												>
											{:else}
												<DropdownMenu.Item onSelect={() => dayMenuAct('?/blockDay', 'date', date)}
													>Block day</DropdownMenu.Item
												>
											{/if}
										</DropdownMenu.Group>
										{#if dayKind === 'teaching'}
											{@const availableSlots = availableSlotLines(data.week.cells, date)}
											{#if availableSlots.length > 0}
												<DropdownMenu.Separator />
												<DropdownMenu.Group>
													<DropdownMenu.GroupHeading class="text-muted-foreground"
														>Block one Slot</DropdownMenu.GroupHeading
													>
													<!-- One line per real Slot, so a Lesson over two Periods appears
													     twice. Picking one opens the note dialog. -->
													{#each availableSlots as slot (slot.slotId)}
														<DropdownMenu.Item onSelect={() => (slotNote = { ...slot, date })}
															>{slot.classLabel}, P{slot.period}…</DropdownMenu.Item
														>
													{/each}
												</DropdownMenu.Group>
											{/if}
											{#if date >= data.today}
												{@const placeableSlots = availableSlots.filter((s) => !s.placed)}
												{#if placeableSlots.length > 0}
													<DropdownMenu.Separator />
													<DropdownMenu.Group>
														<DropdownMenu.GroupHeading class="text-muted-foreground"
															>Place a Lesson</DropdownMenu.GroupHeading
														>
														<!-- Placing is future-and-today only (issue #254), unlike Block one
													     Slot above — a past week's day menu shows no line here. Every
													     Available Slot is offered, an Open one and one a Topic Lesson
													     holds alike (issue #256): a Placement claims its Slot ahead of
													     the Topic stream, so the Lesson there and every Lesson after it
													     shift right. Only a Slot already holding a placed Lesson is left
													     out, matching the Session page's own `canPlace` (sessions.ts). Lands on
													     the Session page's own Place-a-Lesson card, the one place the
													     title is typed. -->
														{#each placeableSlots as slot (slot.slotId)}
															<DropdownMenu.Item
																onSelect={() => openToPlace(slot.classId, date, slot.period)}
																>Open {slot.classLabel}, P{slot.period} to place…</DropdownMenu.Item
															>
														{/each}
													</DropdownMenu.Group>
												{/if}
											{/if}
										{/if}
										{#if blockedSlots.length > 0}
											<DropdownMenu.Separator />
											<DropdownMenu.Group>
												<DropdownMenu.GroupHeading class="text-muted-foreground"
													>Blocked Slots</DropdownMenu.GroupHeading
												>
												{#each blockedSlots as slot (slot.blockedSlotId)}
													<DropdownMenu.Item
														onSelect={() => dayMenuAct('?/unblockSlot', 'id', slot.blockedSlotId)}
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
										dayKind === 'holiday' ? 'School holiday' : (blockedDay?.note ?? 'Blocked day')}
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
												class="hatched flex h-full min-h-16 flex-col rounded-lg border border-dashed px-1.5 py-1.5 md:px-2"
											>
												<div class="text-xs font-semibold text-muted-foreground">
													{cell.classLabel}
												</div>
												<!-- The note is part of today's full tile, back from `md`; below it the
											     tile gives way to its Class alone (issue #343). -->
												<div class="mt-0.5 hidden md:block">
													<div class="line-clamp-2 text-xs text-muted-foreground/80 italic">
														{cell.blockedNote ?? 'Blocked'}
													</div>
												</div>
											</div>
										{:else}
											<!-- A past tile is the record of what happened, not a removal: it keeps
											its Class Tone and text, and takes the hatch only to step back from the
											upcoming tiles. Its Session page opens like any other. -->
											<a
												href={sessionHref({
													classId: cell.classId,
													date: cell.date,
													period: cell.periodFrom
												})}
												class={cn(
													'relative flex h-full min-h-16 w-full flex-col overflow-hidden rounded-lg border px-1.5 py-1.5 text-left md:px-2',
													cell.past && 'hatched'
												)}
												style:background-color={tone.bg}
												style:border-color={tone.ring}
											>
												<span class="truncate text-xs font-semibold" style:color={tone.fg}>
													{cell.classLabel}
												</span>
												{#if cell.kind === 'lesson'}
													<!-- The tiles give way, not the grid (issue #343): below `sm` a tile shows
											     its Class alone, the Lesson title returns from `sm`, and the Topic
											     line is today's full tile back from `md`. The wrapper spans own the
											     visibility at each size, so the clamps the inner spans own stay whole. -->
													<span class="mt-0.5 hidden sm:block">
														<span
															class="line-clamp-2 text-xs leading-tight font-medium"
															style:color={tone.fg}>{cell.lesson?.title}</span
														>
													</span>
													{#if cell.lesson?.topicName}
														<span class="mt-auto hidden md:block">
															<span
																class="line-clamp-1 text-[11px] opacity-80"
																style:color={tone.fg}>{cell.lesson.topicName}</span
															>
														</span>
													{:else}
														<!-- A placed Lesson carries no Topic (issue #254): the dashed inner
													     ring plus this line are what tell it apart from a Topic Lesson's
													     tile at a glance, no change to the Class's own Tone. -->
														<span class="mt-auto hidden md:block">
															<span
																class="line-clamp-1 text-[11px] italic opacity-80"
																style:color={tone.fg}>Standalone Lesson</span
															>
														</span>
														<span
															data-standalone-ring
															class="pointer-events-none absolute inset-1 rounded-md border border-dashed"
															style:border-color={tone.ring}
														></span>
													{/if}
												{:else}
													<span class="mt-0.5 text-xs italic" style:color={tone.fg}>
														<span class="md:hidden">Open</span><span class="hidden md:inline"
															>Open Slot</span
														>
													</span>
												{/if}
											</a>
										{/if}
									</td>
								{/if}
							{/if}
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>

		<!-- Mounted once for the whole grid: the menu sets the picked Slot, the dialog asks for
		     its note, and the binding carries the close back — Escape, the X, a click on the
		     overlay and a saved note all clear the pick. -->
		<BlockNoteDialog bind:pick={slotNote} />
	{:else}
		<p class="text-sm text-muted-foreground">This is not a Teaching Week.</p>
	{/if}
</div>

<style>
	/*
		The hatch marks a position that is not an upcoming Session. A Blocked Day and a Blocked
		Slot drain the colour instead of keeping it (CONTEXT.md, Calendar): present-but-empty and
		removed must never read alike. A past Session or Open Slot keeps its Class Tone and lays the
		hatch over it, so it reads as done rather than removed. The texture is derived from
		--muted-foreground, so it reads in both themes with no dark-mode branch.
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
