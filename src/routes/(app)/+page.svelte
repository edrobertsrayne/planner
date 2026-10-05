<script lang="ts">
	import { page } from '$app/state';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import { classTone } from '$lib/class-tone';
	import { formatWeekday } from '$lib/date';
	import { replaceQuery } from '$lib/client/enhance';
	import { sessionHref } from '$lib/client/session-href';
	import { withParam } from '$lib/query';
	import { touchTarget } from '$lib/components/ui/touch-target';
	import FilterChips from '$lib/components/filter-chips.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import TagChips from '$lib/components/tag-chips.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { AGENDA_HORIZONS } from './agenda-horizons';
	import { filterByTag, groupByDay, horizonEndsOn, tagsIn } from './agenda-days';
	import ReadyTick from './ready-tick.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

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

	const days = $derived(groupByDay(filterByTag(data.rows, data.tag)));
	const pastDays = $derived(groupByDay(filterByTag(data.lookBack, data.tag)));

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
		<!-- The top bar names the screen on a phone, so below `md` the heading goes and the
		     days start near the top (issue #342). -->
		<h1 class="hidden text-lg font-semibold tracking-tight md:block">Agenda</h1>
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
				<Tabs.List variant="line">
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

	{#snippet agendaRow(row: (typeof data.rows)[number], past: boolean)}
		{@const tone = classTone(row.tone)}
		<li class="group/row relative flex items-center gap-3 pr-2 pl-4 hover:bg-muted/40">
			<span
				class="absolute inset-y-0 left-0 w-1"
				style:background-color={tone.ring}
				aria-hidden="true"
			></span>

			<span class="w-14 shrink-0 text-xs text-muted-foreground tabular-nums">
				P{row.periodFrom}{#if row.periodTo !== row.periodFrom}–P{row.periodTo}{/if}
			</span>

			<!-- The Class chip sits in a fixed-width column, so the titles line up (issue #341). -->
			<span class="w-16 shrink-0">
				<span
					class="rounded-2xl px-2 py-0.5 text-xs font-medium whitespace-nowrap"
					style:background-color={tone.bg}
					style:color={tone.fg}
				>
					{row.classLabel}
				</span>
			</span>

			<!-- eslint-disable svelte/no-navigation-without-resolve -- sessionHref resolves it -->
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
			<!-- eslint-enable svelte/no-navigation-without-resolve -->

			<!-- A past row carries no Ready tick: Readiness is written ahead only. -->
			{#if !row.lesson}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- sessionHref resolves it -->
				<Button variant="ghost" size="sm" class="h-7 row-control" href={hrefOf(row)}>Plan</Button>
			{:else if !past}
				<ReadyTick
					lessonId={row.lesson.id}
					classId={row.classId}
					ready={row.lesson.ready}
					label="Ready to teach {row.lesson.title} to {row.classLabel}"
				/>
			{/if}
		</li>
	{/snippet}

	<!-- The look-back: the past seven days, shown when the teacher turns it on, fixed whatever the
	     horizon. Told apart from the days ahead by a step in shade, never a hue, as the Calendar marks
	     a day with no teaching. -->
	{#if pastDays.length > 0}
		<div aria-label="Past seven days" role="region">
			{#each pastDays as day (day.date)}
				<section class="mt-6">
					<h2 class="mb-2 text-sm font-semibold text-muted-foreground">
						{formatWeekday(day.date)}
					</h2>
					<ul class="divide-y divide-border overflow-hidden rounded-xl border bg-muted/50">
						{#each day.rows as row (row.classId + row.periodFrom)}
							{@render agendaRow(row, true)}
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	{/if}

	{#if days.length === 0}
		<div class="mt-6 rounded-xl border border-dashed px-6 py-12 text-center">
			<p class="text-sm font-medium">Nothing in this window</p>
			<p class="mt-1 text-sm text-muted-foreground">
				{data.tag ? `No Lessons with the Tag “${data.tag}”` : 'No Class is timetabled'} between now and
				{formatWeekday(horizonEndsOn(data.today, data.horizon, data.lastTermCloses))}.
			</p>
		</div>
	{/if}

	{#each days as day (day.date)}
		{@const isToday = day.date === data.today}
		<section class="mt-6">
			<h2 class="mb-2 flex items-baseline gap-2 text-sm font-semibold">
				{#if isToday}
					<span class="text-foreground">Today</span>
					<span class="font-normal text-muted-foreground">— {formatWeekday(day.date)}</span>
				{:else}
					<span class="text-muted-foreground">{formatWeekday(day.date)}</span>
				{/if}
				<span class="ml-auto text-xs font-normal text-muted-foreground">Ready to teach?</span>
			</h2>

			<ul class="divide-y divide-border overflow-hidden rounded-xl border bg-card">
				{#each day.rows as row (row.classId + row.periodFrom)}
					{@render agendaRow(row, false)}
				{/each}
			</ul>
		</section>
	{/each}
</div>
