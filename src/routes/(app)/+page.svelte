<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import BanIcon from '@lucide/svelte/icons/ban';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import { classTone } from '$lib/class-tone';
	import { formatWeekday } from '$lib/date';
	import type { AgendaBlockedDay, CoverRef } from '$lib/server/planner';
	import { joinAdjacentPeriods, kindLabel, positionRangeLabel } from '$lib/events';
	import { onFail, replaceQuery, submitForm } from '$lib/client/enhance';
	import { sessionHref } from '$lib/client/session-href';
	import { withParam } from '$lib/query';
	import { Button, touchTarget } from '$lib/ui';
	import BlockDayDialog from '$lib/components/block-day-dialog.svelte';
	import BlockSlotDialog, { type Pick } from '$lib/components/block-slot-dialog.svelte';
	import AbsentMarker from '$lib/components/absent-marker.svelte';
	import ClassChip from '$lib/components/class-chip.svelte';
	import SetCoverDialog, { type CoverPick } from '$lib/components/set-cover-dialog.svelte';
	import FilterChips from '$lib/components/filter-chips.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import RewindReport from '$lib/components/rewind-report.svelte';
	import TagChips from '$lib/components/tag-chips.svelte';
	import * as Tabs from '$lib/ui/tabs';
	import { AGENDA_HORIZONS } from './agenda-horizons';
	import {
		agendaStream,
		filterByTag,
		groupByDay,
		lessonCount,
		tagsIn,
		withEvents
	} from './agenda-days';
	import ReadyTick from './ready-tick.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Each filter sets one parameter and keeps the rest, so a change to the horizon or the
	// look-back keeps the Tag in the address (withParam, issue #338).
	function setHorizon(horizon: string | number) {
		return replaceQuery(withParam(page.url, 'horizon', String(horizon)));
	}

	function toggleLookBack() {
		return replaceQuery(withParam(page.url, 'past', data.lookBackOn ? null : '1'));
	}

	function hrefOf(row: (typeof data.rows)[number]) {
		return sessionHref({ classId: row.classId, date: row.date, period: row.periodFrom });
	}

	// A row's Blocked Slot is asked for through the note dialog, and taken back through one hidden
	// form that every row's Unblock shares: its one field is set beside the value (submitForm).
	type Row = (typeof data.rows)[number];
	let pick = $state<Pick | null>(null);
	let unblockForm = $state<HTMLFormElement | undefined>();
	const askToBlock = (row: Row) =>
		(pick = {
			classId: row.classId,
			classLabel: row.classLabel,
			slotIds: row.slotIds,
			period: row.periodFrom,
			periodTo: row.periodTo,
			date: row.date,
			lessonTitle: row.lesson?.title ?? null
		});

	// The Slot of a Blocked Slot row, for the Set cover dialog.
	const slotPick = (row: Row): CoverPick => ({
		classId: row.classId,
		classLabel: row.classLabel,
		date: row.date,
		slotId: row.slotId,
		period: row.periodFrom
	});

	// An Event has no Tag, so a Tag filter leaves it out, as it leaves out an Open Slot.
	// One Event over adjacent Periods is one row: its note belongs to the Event and the date.
	const eventsIn = (events: typeof data.events) =>
		data.tag === null ? joinAdjacentPeriods(events) : [];
	const days = $derived(
		withEvents(groupByDay(filterByTag(data.rows, data.tag)), eventsIn(data.events))
	);
	// A whole day is asked for through its own dialog and taken back through one hidden form that
	// every Blocked Day panel shares, as a Blocked Slot is.
	let dayPick = $state<string | null>(null);
	// Counted when the dialog opens and kept while it fades out, so the line about how much moves
	// does not flip to "nothing" as it closes. Counted from every row, not the Tag-filtered ones.
	let dayLessons = $state(0);
	const askToBlockDay = (date: string) => {
		dayLessons = lessonCount(data.rows, date);
		dayPick = date;
	};
	let unblockDayForm = $state<HTMLFormElement | undefined>();
	// A Cover is set through its own dialog and taken back through one hidden form, as above.
	let coverPick = $state<CoverPick | null>(null);
	let clearCoverForm = $state<HTMLFormElement | undefined>();
	const stream = $derived(agendaStream(days, data.blockedDays, data.holidays));
	const pastStream = $derived(
		agendaStream(
			withEvents(groupByDay(filterByTag(data.lookBack, data.tag)), eventsIn(data.lookBackEvents)),
			data.lookBackBlockedDays,
			[]
		)
	);

	const lineKey = (line: (typeof days)[number]['rows'][number]) =>
		line.kind === 'row'
			? `${line.row.classId}${line.row.periodFrom}`
			: `${line.event.eventId}${line.event.position}`;

	type AgendaEvent = ReturnType<typeof joinAdjacentPeriods<(typeof data.events)[number]>>[number];

	const eventHref = (event: AgendaEvent) =>
		`${resolve(`/events/${event.eventId}`)}?date=${event.date}#date-${event.date}`;

	// One chip per Tag in the window with its count (issue #340). A Tag with no Lesson in the
	// window keeps its chip at a count of zero, so a filter on it can still be cleared.
	const tagOption = (name: string, count: number) => ({ value: name, label: name, count });
	const tags = $derived(tagsIn([...data.lookBack, ...data.rows]));
	const tagOptions = $derived([
		...tags.map((t) => tagOption(t.name, t.count)),
		...(data.tag && !tags.some((t) => t.name === data.tag) ? [tagOption(data.tag, 0)] : [])
	]);
</script>

<svelte:head><title>Agenda</title></svelte:head>

<div class="mx-auto max-w-6xl px-6 py-6">
	<PageHeader>
		<!-- The top bar names the screen on a phone, so below `md` the heading is out of sight (a
		     screen reader still reads it) and the days start near the top (issue #342). -->
		<h1
			class="sr-only text-[26px] leading-8 font-bold tracking-tight md:not-sr-only md:text-[32px] md:leading-10 md:font-semibold"
		>
			Agenda
		</h1>
		{#snippet actions()}
			<!-- The horizon is tabs at the right of the heading (issue #341), the same tab style as
			     Draft/Planned on Planning. Below `md` the heading is hidden (issue #342), so the
			     tabs sit where the heading would. -->
			<Tabs.Root
				value={String(data.horizon)}
				onValueChange={(v) => {
					if (v) setHorizon(v);
				}}
			>
				<Tabs.List variant="segmented">
					{#each AGENDA_HORIZONS as [n, label] (n)}
						<Tabs.Trigger value={String(n)}>{label}</Tabs.Trigger>
					{/each}
				</Tabs.List>
			</Tabs.Root>
		{/snippet}
	</PageHeader>

	<!-- The Tag chips under the heading, the same control as the Class chips on Planning (issue
	     #340): the value lives in the query string, so a Back from a Session keeps the filter. -->
	<FilterChips
		param="tag"
		value={data.tag}
		allLabel="All Lessons"
		label="Filter by Tag"
		options={tagOptions}
		class="-mx-6 mt-4 px-6 md:mx-0 md:px-0"
	/>

	<!-- A write that pushed a Placement off its anchor says so, as on the Calendar. -->
	<RewindReport report={form?.report} class="mt-4 text-sm text-muted-foreground" />

	<form
		bind:this={unblockForm}
		method="POST"
		action="?/unblockSlot"
		use:enhance={onFail('Could not unblock the Slot.')}
		class="hidden"
	></form>

	<form
		bind:this={clearCoverForm}
		method="POST"
		action="?/clearCover"
		use:enhance={onFail('Could not clear the Cover.')}
		class="hidden"
	></form>

	<form
		bind:this={unblockDayForm}
		method="POST"
		action="?/unblockDay"
		use:enhance={onFail('Could not unblock the day.')}
		class="hidden"
	></form>

	<!-- The look-back sits where it appears (issue #341): this full-width button above the first
	     day replaces the "Previous 7 days" toggle in the header. -->
	<button
		type="button"
		class="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed text-xs font-medium text-muted-foreground hover:bg-muted md:h-8 {touchTarget}"
		onclick={toggleLookBack}
	>
		<HistoryIcon class="size-3.5" />
		{data.lookBackOn ? 'Hide the previous 7 days' : 'Show the previous 7 days'}
	</button>

	<!-- What an Absence offers for one Slot: its Cover as a link into the Lesson editor, and a button to
	     set or clear it. The button is from a tablet up, as every Agenda write is; a phone reads the
	     Cover and nothing more. A Cover is plain text beside the marker, never an alert: an Absence
	     with none set is not a fault. -->
	{#snippet coverLink(cover: CoverRef | null)}
		{#if cover}
			<a
				href={resolve(`/lessons/${cover.lessonId}`)}
				class="block text-xs font-medium underline underline-offset-4 outline-none focus-visible:no-underline"
				>Cover: {cover.title}</a
			>
		{/if}
	{/snippet}

	{#snippet coverButton(slot: CoverPick, cover: CoverRef | null)}
		{#if cover}
			<Button
				variant="ghost"
				size="sm"
				class="h-7 text-muted-foreground max-md:hidden {touchTarget}"
				onclick={() => submitForm(clearCoverForm, { fields: { id: cover.id } })}
				aria-label="Clear the Cover for {slot.classLabel}, P{slot.period}">Clear</Button
			>
		{:else}
			<Button
				variant="ghost"
				size="sm"
				class="h-7 gap-1 max-md:hidden {touchTarget}"
				onclick={() => (coverPick = slot)}
				aria-label="Set cover for {slot.classLabel}, P{slot.period}"
			>
				<PlusIcon class="size-3.5" /> Set cover
			</Button>
		{/if}
	{/snippet}

	{#snippet agendaRow(row: (typeof data.rows)[number], past: boolean)}
		{@const tone = classTone(row.tone)}
		{@const blocked = row.blocked}
		<li
			class="group/row relative flex items-center gap-3 pr-2 {blocked
				? 'hatched'
				: 'hover:bg-muted/40'}"
		>
			<!-- The Period in the Class's Tone: a tile that names the Period and its room, a Blocked
			     Slot's own in the neutral step. -->
			<span
				class="my-3 ml-4 flex min-h-12 w-14 shrink-0 flex-col items-center justify-center rounded-lg px-1 text-center text-[13px] leading-tight font-bold tabular-nums {blocked
					? 'bg-surface text-foreground'
					: ''}"
				style:background-color={blocked ? undefined : tone.bg}
				style:color={blocked ? undefined : tone.fg}
			>
				P{row.periodFrom}{#if row.periodTo !== row.periodFrom}–P{row.periodTo}{/if}
				{#if row.room}<span
						class="max-w-full truncate text-[11px] font-medium opacity-80"
						title={row.room}>{row.room}</span
					>{/if}
			</span>

			<!-- The Class chip sits in a fixed-width column, so the titles line up (issue #341), and opens
			     the Class's page. -->
			<span class="w-24 shrink-0">
				<ClassChip classId={row.classId} label={row.classLabel} tone={row.tone} />
			</span>

			<!-- A Blocked Slot is removed: nothing to open, plan or tick, so it takes the Calendar's
			     hatch, never a hue, with its note. -->
			{#if blocked}
				<span class="min-w-0 flex-1 py-3">
					{#if blocked.absent}
						<AbsentMarker />
					{:else}
						<span class="block text-sm text-muted-foreground italic">Blocked Slot</span>
					{/if}
					{#if blocked.note}
						<span class="block text-xs text-muted-foreground">{blocked.note}</span>
					{/if}
					{@render coverLink(blocked.cover)}
				</span>
			{:else}
				<a
					href={hrefOf(row)}
					class="min-w-0 flex-1 py-3 text-left outline-none focus-visible:underline"
				>
					{#if row.lesson}
						<!-- A title or a Topic name wraps in full, never truncates (issue #341). -->
						<span class="block text-sm font-medium">{row.lesson.title}</span>
						<span class="block text-xs text-muted-foreground">
							{#if row.lesson.topicName}
								{row.lesson.topicName}
							{/if}
						</span>
						<TagChips tags={row.lesson.tags} class="mt-1" />
					{:else}
						<span class="block text-sm text-muted-foreground italic">Open Slot</span>
					{/if}
				</a>
			{/if}

			<!-- A past row carries no Ready tick: Readiness is written ahead only. -->
			{#if blocked}
				{#if blocked.absent}
					{@render coverButton(slotPick(row), blocked.cover)}
				{/if}
				{#if !past}
					<Button
						variant="ghost"
						size="sm"
						class="h-7 row-control max-md:hidden {touchTarget}"
						onclick={() => submitForm(unblockForm, { fields: { id: blocked.id } })}
						aria-label="Unblock {row.classLabel}, P{row.periodFrom}">Unblock</Button
					>
				{/if}
			{:else if !row.lesson}
				<Button variant="ghost" size="sm" class="h-7 row-control" href={hrefOf(row)}>Plan</Button>
			{/if}
			{#if !blocked && !past}
				<Button
					variant="ghost"
					size="icon-sm"
					class="row-control max-md:hidden {touchTarget}"
					onclick={() => askToBlock(row)}
					aria-label="Block {row.classLabel}, P{row.periodFrom}"
				>
					<BanIcon class="size-4" />
				</Button>
			{/if}
			{#if !blocked && row.lesson && !past}
				<div class="hidden md:contents">
					<ReadyTick
						lessonId={row.lesson.id}
						classId={row.classId}
						ready={row.lesson.ready}
						label="Ready to teach {row.lesson.title} to {row.classLabel}"
					/>
				</div>
			{/if}
		</li>
	{/snippet}

	<!-- An Event: a neutral bar, never a Class's hue, and no Ready tick (ADR-0029). The note is the
	     plan or the log; with none, the row offers to add one. -->
	{#snippet eventRow(event: AgendaEvent, past: boolean)}
		<li class="relative flex items-center gap-3 bg-muted pr-2">
			<span
				class="my-3 ml-4 flex min-h-12 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-surface px-1 text-center text-[13px] leading-tight font-bold tabular-nums"
			>
				{positionRangeLabel(event.position, event.positionTo)}
				{#if event.room}<span
						class="max-w-full truncate text-[11px] font-medium text-muted-foreground"
						title={event.room}>{event.room}</span
					>{/if}
			</span>
			<span class="w-24 shrink-0">
				<span
					class="rounded-2xl bg-muted px-2 py-0.5 text-xs font-medium whitespace-nowrap text-muted-foreground"
					>{kindLabel(event.kind)}</span
				>
			</span>
			<a
				href={eventHref(event)}
				class="min-w-0 flex-1 py-3 text-left outline-none focus-visible:underline"
			>
				<span class="block text-sm font-medium">{event.name}</span>
				{#if event.note}
					<span class="block text-xs whitespace-pre-wrap text-muted-foreground">{event.note}</span>
				{/if}
			</a>
			{#if !event.note}
				<Button variant="ghost" size="sm" class="h-7 row-control" href={eventHref(event)}>
					{past ? 'Add log' : 'Add plan'}
				</Button>
			{/if}
		</li>
	{/snippet}

	{#snippet agendaLine(line: (typeof days)[number]['rows'][number], past: boolean)}
		{#if line.kind === 'row'}
			{@render agendaRow(line.row, past)}
		{:else}
			{@render eventRow(line.event, past)}
		{/if}
	{/snippet}

	<!-- A Blocked Day as one panel. An Absence lists each Class and Period it takes, so its Cover is
	     set (or read) from here; a past day, in the look-back, has no Unblock (ADR-0030). -->
	{#snippet blockedDayPanel(item: AgendaBlockedDay, past: boolean)}
		<div class="overflow-hidden rounded-xl border bg-muted">
			<div class="flex items-center gap-3 py-3 pr-2 pl-4">
				<div class="min-w-0 flex-1">
					{#if item.absent}
						<p class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
							<AbsentMarker /> All day
						</p>
					{:else}
						<p class="text-sm font-medium text-muted-foreground">Blocked Day</p>
					{/if}
					{#if item.note}
						<p class="text-xs text-muted-foreground">{item.note}</p>
					{/if}
				</div>
				{#if !past}
					<Button
						variant="ghost"
						size="sm"
						class="h-7 {touchTarget}"
						onclick={() => submitForm(unblockDayForm, { fields: { date: item.date } })}
						aria-label="Unblock {formatWeekday(item.date)}">Unblock day</Button
					>
				{/if}
			</div>
			<!-- An Absence lists each Class and Period it takes, so its Cover is set from here. -->
			{#if item.lines.length > 0}
				<ul class="divide-y divide-border border-t bg-surface">
					{#each item.lines as line (line.classId + line.period)}
						<li class="relative flex items-center gap-3 pr-2 pl-4">
							<span
								class="w-14 shrink-0 text-[13px] font-semibold text-muted-foreground tabular-nums"
							>
								P{line.period}
								{#if line.room}<span class="block truncate" title={line.room}>{line.room}</span
									>{/if}
							</span>
							<span class="w-16 shrink-0">
								<ClassChip classId={line.classId} label={line.classLabel} tone={line.tone} />
							</span>
							<span class="min-w-0 flex-1 py-3">
								{#if line.cover}
									{@render coverLink(line.cover)}
								{:else}
									<span class="block text-xs text-muted-foreground">No Cover recorded</span>
								{/if}
							</span>
							{@render coverButton(
								{
									classId: line.classId,
									classLabel: line.classLabel,
									date: line.date,
									slotId: line.slotId,
									period: line.period
								},
								line.cover
							)}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/snippet}

	<!-- The look-back: the past seven days, shown when the teacher turns it on, fixed whatever the
	     horizon. Told apart from the days ahead by a step in shade, never a hue, as the Calendar marks
	     a day with no teaching. -->
	{#if pastStream.length > 0}
		<div aria-label="Past seven days" role="region">
			{#each pastStream as item (item.kind + item.date)}
				<section class="mt-6">
					<h2 class="mb-2 text-sm font-semibold text-muted-foreground">
						{formatWeekday(item.date)}
					</h2>
					{#if item.kind === 'day'}
						<ul class="divide-y divide-border overflow-hidden rounded-xl border bg-muted/50">
							{#each item.rows as line (lineKey(line))}
								{@render agendaLine(line, true)}
							{/each}
						</ul>
					{:else if item.kind === 'blocked'}
						{@render blockedDayPanel(item, true)}
					{/if}
				</section>
			{/each}
		</div>
	{/if}

	{#if days.length === 0}
		<div class="mt-6 rounded-xl border border-dashed px-6 py-12 text-center">
			<p class="text-sm font-medium">Nothing in this window</p>
			<p class="mt-1 text-sm text-muted-foreground">
				{data.tag ? `No Lessons with the Tag “${data.tag}”` : 'No Class is timetabled'} between now and
				{formatWeekday(data.horizonEnds)}.
			</p>
		</div>
	{/if}

	{#snippet dayHeading(date: string)}
		{#if date === data.today}
			<span class="text-foreground">Today</span>
			<span class="font-normal text-muted-foreground">— {formatWeekday(date)}</span>
		{:else}
			<span class="text-muted-foreground">{formatWeekday(date)}</span>
		{/if}
	{/snippet}

	<!-- The days ahead, with what the window removes in place: a Blocked Day keeps its heading and
	     reads as one panel, and a School Holiday is one card spanning it, so a holiday never leaves
	     the page blank. Both are told apart from teaching by a step in shade, never a hue. -->
	<BlockSlotDialog bind:pick />
	<BlockDayDialog bind:date={dayPick} lessons={dayLessons} />
	<SetCoverDialog bind:pick={coverPick} choices={data.coverChoices} />

	{#each stream as item (item.kind + item.date)}
		{#if item.kind === 'day'}
			<section class="mt-6">
				<!-- The hover group is the heading alone: on the whole section, hovering any row would
				     reveal every row's controls in the day. -->
				<h2 class="group/row mb-2 flex items-center gap-2 text-sm font-semibold">
					{@render dayHeading(item.date)}
					<Button
						variant="ghost"
						size="sm"
						class="ml-auto h-7 gap-1 text-xs font-normal text-muted-foreground row-control {touchTarget}"
						onclick={() => askToBlockDay(item.date)}
						aria-label="Block {formatWeekday(item.date)}"
					>
						<BanIcon class="size-3.5" /> Block day
					</Button>
				</h2>

				<ul class="divide-y divide-border overflow-hidden rounded-xl border bg-surface">
					{#each item.rows as line (lineKey(line))}
						{@render agendaLine(line, false)}
					{/each}
				</ul>
			</section>
		{:else if item.kind === 'blocked'}
			<section class="mt-6">
				<h2 class="mb-2 flex items-baseline gap-2 text-sm font-semibold">
					{@render dayHeading(item.date)}
				</h2>
				{@render blockedDayPanel(item, false)}
			</section>
		{:else}
			<section class="mt-6">
				<div class="rounded-xl border border-dashed bg-muted px-4 py-4">
					<h2 class="text-sm font-semibold">School Holiday</h2>
					<p class="text-sm text-muted-foreground">
						{formatWeekday(item.date)} – {formatWeekday(item.ends)}
					</p>
				</div>
			</section>
		{/if}
	{/each}
</div>
