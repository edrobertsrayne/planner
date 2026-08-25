<script lang="ts">
	import { enhance } from '$app/forms';
	import BanIcon from '@lucide/svelte/icons/ban';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { classTone } from '$lib/class-tone';
	import { formatDayMonth } from '$lib/date';
	import { refresh } from '$lib/client/enhance';
	import { openSession } from '$lib/client/session-panel.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import PageHeader from '$lib/components/page-header.svelte';
	import BlockPopover from './BlockPopover.svelte';
	import { PERIODS, toGrid } from './calendar-grid';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

	// One entry per (day, Period); see calendar-grid.ts. The explicit `h-16` on a start cell's
	// <td> is what lets the tile's `h-full` resolve, so a multi-Period Lesson renders as one tall
	// tile rather than silently collapsing to one Period.
	const grid = $derived.by(() => toGrid(data.week?.dates ?? [], data.week?.cells ?? []));
	const blockedByDate = $derived(new Map((data.week?.blockedDays ?? []).map((b) => [b.date, b])));
</script>

<svelte:head><title>Calendar</title></svelte:head>

<div class="mx-auto max-w-6xl px-6 py-6">
	<PageHeader title="Calendar" description="One Teaching Week, Periods against days.">
		{#snippet actions()}
			{#if data.week}
				{@const otherLetter = data.week.letter === 'A' ? 'B' : 'A'}
				<div class="flex items-center gap-2">
					<!-- eslint-disable svelte/no-navigation-without-resolve -- carries a query string -->
					<Button
						variant="ghost"
						size="icon-sm"
						href={data.prev ?? undefined}
						disabled={!data.prev}
						aria-label="Previous Teaching Week"
					>
						<ChevronLeftIcon />
					</Button>

					<div class="flex items-center gap-0.5 rounded-md border p-0.5">
						{#each data.ribbon as w (w.weekCommencing)}
							{@const isSelected = w.weekCommencing === data.selected}
							<a
								href={`?week=${w.weekCommencing}`}
								aria-current={isSelected ? 'true' : undefined}
								class="flex h-6 items-center rounded-sm px-2 text-xs font-medium tabular-nums {isSelected
									? 'bg-secondary text-secondary-foreground'
									: 'text-muted-foreground hover:bg-muted'}"
								title="w/c {formatDayMonth(w.weekCommencing)}"
							>
								{w.letter}<span class="ml-1 font-normal opacity-70">{formatDayMonth(w.weekCommencing)}</span
								>
							</a>
						{/each}
					</div>

					<Button
						variant="ghost"
						size="icon-sm"
						href={data.next ?? undefined}
						disabled={!data.next}
						aria-label="Next Teaching Week"
					>
						<ChevronRightIcon />
					</Button>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->

					<form
						method="POST"
						action="?/setLetter"
						use:enhance={refresh}
					>
						<input type="hidden" name="weekCommencing" value={data.week.weekCommencing} />
						<input type="hidden" name="letter" value={otherLetter} />
						<Button type="submit" variant="ghost" size="sm">
							Switch to Week {otherLetter}
						</Button>
					</form>
				</div>
			{/if}
		{/snippet}
	</PageHeader>

	{#if form?.atRisk && form.atRisk.length > 0}
		<Alert.Root class="mb-4">
			<TriangleAlertIcon />
			<Alert.Title>
				The Rewind changed the Lesson on {form.atRisk.length === 1
					? 'a noted Session'
					: `${form.atRisk.length} noted Sessions`} — check the note still applies.
			</Alert.Title>
			<Alert.Description>
				<ul class="mt-1 list-disc pl-4">
					{#each form.atRisk as s (s.classId + s.date + s.period)}
						<li>{s.classLabel} · {s.date} P{s.period} — now {s.lessonTitle}</li>
					{/each}
				</ul>
			</Alert.Description>
		</Alert.Root>
	{/if}

	{#if data.ribbon.length === 0}
		<p class="text-sm text-muted-foreground">No Teaching Weeks are set up yet.</p>
	{:else if data.week}
		<div class="overflow-x-auto">
			<table class="w-full table-fixed border-separate border-spacing-1.5">
				<thead>
					<tr>
						<th class="w-12"></th>
						{#each DAY_NAMES as d, di (d)}
							{@const date = data.week.dates[di]}
							{@const blockedDay = blockedByDate.get(date)}
							<th class="pb-1 text-left align-bottom">
								<div class="flex items-baseline gap-1.5">
									<span class="text-sm font-semibold">{d}</span>
									<span class="text-xs font-normal text-muted-foreground">{formatDayMonth(date)}</span>
									{#if blockedDay}
										<form
											method="POST"
											action="?/unblockDay"
											class="ml-auto"
											use:enhance={refresh}
										>
											<input type="hidden" name="id" value={blockedDay.id} />
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
								{@const entry = grid[di][period - 1]}
								{#if entry.type === 'covered'}
									<!-- covered by an earlier Period's rowspan -->
								{:else if entry.type === 'free'}
									<td class="h-16 rounded-lg bg-muted/40"></td>
								{:else}
									{@const cell = entry.cell}
									{@const rowspan = cell.periodTo - cell.periodFrom + 1}
									{@const tone = classTone(cell.tone)}
									<td {rowspan} class="group/cell relative h-16 align-top">
										{#if cell.kind === 'blocked'}
											<div
												class="hatched flex h-full min-h-16 flex-col rounded-lg border border-dashed px-2 py-1.5"
											>
												<div class="text-xs font-semibold text-muted-foreground">
													{cell.classLabel}
												</div>
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
															name="id"
															value={cell.blockedSlotId ?? cell.blockedDayId}
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
													<span
														class="mt-auto line-clamp-1 text-[11px] opacity-80"
														style:color={tone.fg}>{cell.lesson?.topicName}</span
													>
												{:else}
													<span class="mt-0.5 text-xs italic" style:color={tone.fg}>
														Unplanned
													</span>
												{/if}
											</button>

											{#if cell.periodFrom === cell.periodTo}
												<!-- A Lesson with Planned Length > 1 spans several Periods as one merged
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
			Drained = removed — a Blocked Day, a Blocked Slot, or a date outside every Term. Coloured with
			no Lesson = Unplanned — the Class is taught, nothing is planned for it yet. An empty cell is a
			Period no Class holds. Click any tile to open its Session.
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
	*/
	.hatched {
		background-image: repeating-linear-gradient(
			135deg,
			color-mix(in oklab, var(--muted-foreground) 14%, transparent) 0 5px,
			transparent 5px 10px
		);
	}
</style>
