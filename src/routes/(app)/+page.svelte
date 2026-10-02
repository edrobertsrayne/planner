<script lang="ts">
	import { classTone } from '$lib/class-tone';
	import { formatWeekday } from '$lib/date';
	import { replaceQuery } from '$lib/client/enhance';
	import { openSession } from '$lib/client/session-panel.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import TagChips from '$lib/components/tag-chips.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Toggle } from '$lib/components/ui/toggle';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
	import { AGENDA_HORIZONS } from './agenda-horizons';
	import { filterByTag, groupByDay, horizonEndsOn, tagsIn } from './agenda-days';
	import ReadyTick from './ready-tick.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The horizon, the Tag and the look-back share the query string, so a change to one keeps the others.
	function setQuery({
		horizon = data.horizon,
		tag = data.tag,
		lookBackOn = data.lookBackOn
	}: {
		horizon?: string | number;
		tag?: string | null;
		lookBackOn?: boolean;
	}) {
		const tagPart = tag ? `&tag=${encodeURIComponent(tag)}` : '';
		return replaceQuery(`?horizon=${horizon}${tagPart}${lookBackOn ? '&past=1' : ''}`);
	}

	function openOccasion(row: (typeof data.rows)[number]) {
		openSession({ classId: row.classId, date: row.date, period: row.periodFrom });
	}

	const days = $derived(groupByDay(filterByTag(data.rows, data.tag)));
	const pastDays = $derived(groupByDay(filterByTag(data.lookBack, data.tag)));
	const tags = $derived(tagsIn([...data.lookBack, ...data.rows]));
</script>

<svelte:head><title>Agenda</title></svelte:head>

<div class="mx-auto max-w-3xl px-6 py-6">
	<PageHeader title="Agenda" description="What is coming up, in order.">
		{#snippet actions()}
			<Select.Root
				type="single"
				value={data.tag ?? ''}
				onValueChange={(v) => setQuery({ tag: v || null })}
			>
				<Select.Trigger size="sm" aria-label="Tag" class="w-40">
					{data.tag ?? 'All tags'}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="" label="All tags" />
					{#each tags as tag (tag)}
						<Select.Item value={tag} label={tag} />
					{/each}
				</Select.Content>
			</Select.Root>
			<ToggleGroup
				type="single"
				variant="outline"
				size="sm"
				value={String(data.horizon)}
				onValueChange={(v) => {
					if (v) setQuery({ horizon: v });
				}}
			>
				{#each AGENDA_HORIZONS as [n, label] (n)}
					<ToggleGroupItem value={String(n)}>{label}</ToggleGroupItem>
				{/each}
			</ToggleGroup>
			<Toggle
				variant="outline"
				size="sm"
				pressed={data.lookBackOn}
				onPressedChange={(lookBackOn) => setQuery({ lookBackOn })}
			>
				Previous 7 days
			</Toggle>
		{/snippet}
	</PageHeader>

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

			<span
				class="h-fit shrink-0 rounded-2xl px-2 py-0.5 text-xs font-medium"
				style:background-color={tone.bg}
				style:color={tone.fg}
			>
				{row.classLabel}
			</span>

			<button
				type="button"
				data-session-trigger
				class="min-w-0 flex-1 py-3 text-left outline-none focus-visible:underline"
				onclick={() => openOccasion(row)}
			>
				{#if row.lesson}
					<span class="block truncate text-sm font-medium">{row.lesson.title}</span>
					<span class="block truncate text-xs text-muted-foreground">
						{#if row.lesson.topicName}
							{row.lesson.topicName}
						{/if}
					</span>
					<TagChips tags={row.lesson.tags} class="mt-1" />
				{:else}
					<span class="block text-sm text-muted-foreground italic">Open Slot</span>
				{/if}
			</button>

			<!-- A past row carries no Ready tick: Readiness is written ahead only. -->
			{#if !row.lesson}
				<Button
					variant="ghost"
					size="sm"
					class="h-7 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
					data-session-trigger
					onclick={() => openOccasion(row)}
				>
					Plan
				</Button>
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
