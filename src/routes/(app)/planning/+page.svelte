<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { classTone } from '$lib/class-tone';
	import { formatShortWeekday } from '$lib/date';
	import { statusTone, type PlanningStatus } from '$lib/feedback-tone';
	import FilterChips from '$lib/components/filter-chips.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import RewindReport from '$lib/components/rewind-report.svelte';
	import TagChips from '$lib/components/tag-chips.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { page } from '$app/state';
	import { replaceQuery } from '$lib/client/enhance';
	import { withParam } from '$lib/query';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	// PROTOTYPE (#372): one Class's Sequence, when `?class=<id>&proto=1` picks it out.
	import { untrack } from 'svelte';
	import PrototypeSwitcher from '$lib/components/prototype-switcher.svelte';
	import PrototypeSequence from '../classes/[id]/PrototypeSequence.svelte';
	import { ProtoSequence } from '../classes/[id]/prototype-sequence-state.svelte';
	import { prototypeSwitches } from '../classes/[id]/prototype-switches';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Filter = 'all' | PlanningStatus;
	type Entry = (typeof data.stream)[number];

	const FILTERS: { key: Filter; name: string }[] = [
		{ key: 'all', name: 'All' },
		{ key: 'draft', name: 'Draft' },
		{ key: 'planned', name: 'Planned' }
	];

	const RUNGS: { key: PlanningStatus; name: string }[] = [
		{ key: 'planned', name: 'Planned' },
		{ key: 'draft', name: 'Draft' }
	];

	// The status tab lives in the query string (`?status=draft`), like the Class chips (issue
	// #338), so it survives a reload and a Back into the page. A value the tabs do not name is All.
	const filter = $derived.by<Filter>(() => {
		const value = page.url.searchParams.get('status');
		return FILTERS.some((f) => f.key === value) ? (value as Filter) : 'all';
	});

	const tally = $derived({
		all: data.stream.length,
		draft: data.stream.filter((l) => l.status === 'draft').length,
		planned: data.stream.filter((l) => l.status === 'planned').length
	});

	const filtered = $derived(
		filter === 'all' ? data.stream : data.stream.filter((l) => l.status === filter)
	);

	// With no Lessons anywhere and no Class picked there is nothing to filter, so the tabs and
	// the chips stay off the page and "No Lessons yet" speaks alone.
	const noLessonsAnywhere = $derived(data.stream.length === 0 && !data.classId);

	// Each Class chip is filled with its Class's Tone (ADR-0013).
	const classOptions = $derived(
		data.classes.map((c) => ({ value: c.id, label: c.label, tone: classTone(c.tone) }))
	);

	// PROTOTYPE (#372): `?class=<id>&proto=1` turns the list below into that Class's Sequence,
	// so the surface can be judged with Planning's own chrome around it.
	const showProto = $derived(page.url.searchParams.has('proto') && !!data.classId && !!data.proto);
	const proto = $derived(prototypeSwitches(data.classId ?? '', 'planning'));
	// One Sequence per Class picked; a switch change keeps the edits made so far. Keyed on a
	// derived id, so a new `data` with the same Class does not rebuild it.
	const protoClassId = $derived(data.classId ?? '');
	const seq = $derived.by(() => {
		const classId = protoClassId;
		return untrack(
			() =>
				new ProtoSequence(
					data.proto?.sequence ?? [],
					data.protoLayout ?? {
						parts: {},
						unplaced: {},
						locked: [],
						lastSlot: null,
						stream: [],
						weeks: []
					},
					data.proto?.topics ?? [],
					classId
				)
		);
	});
	$effect(() => {
		seq.draft = proto.draft;
	});
</script>

{#snippet classChip(occurrence: NonNullable<Entry['occurrence']>)}
	{@const tone = classTone(occurrence.tone)}
	<span
		class="rounded-2xl px-2 py-0.5 text-xs font-medium whitespace-nowrap"
		style:background-color={tone.bg}
		style:color={tone.fg}
	>
		{occurrence.label}
	</span>
{/snippet}

{#snippet statusToggle(lesson: Entry)}
	<form method="POST" action="?/setLessonStatus" use:enhance class="contents">
		<input type="hidden" name="id" value={lesson.id} />
		<div class="flex shrink-0 overflow-hidden rounded-md border text-xs" role="group">
			{#each RUNGS as rung (rung.key)}
				{@const on = lesson.status === rung.key}
				{@const tone = statusTone(rung.key)}
				<button
					type="submit"
					name="status"
					value={rung.key}
					aria-pressed={on}
					class="px-2 py-1.5 font-medium transition-colors {on
						? ''
						: 'text-muted-foreground hover:bg-muted'}"
					style:background-color={on ? tone.bg : undefined}
					style:color={on ? tone.fg : undefined}
				>
					{rung.name}
				</button>
			{/each}
		</div>
	</form>
{/snippet}

<svelte:head><title>Planning</title></svelte:head>

<div class="mx-auto max-w-6xl px-6 py-6">
	<PageHeader title="Planning">
		{#snippet actions()}
			{#if !noLessonsAnywhere}
				<!-- All / Draft / Planned narrow the table below, and carry their counts. -->
				<Tabs.Root
					value={filter}
					onValueChange={(v) => replaceQuery(withParam(page.url, 'status', v === 'all' ? null : v))}
				>
					<Tabs.List variant="line">
						{#each FILTERS as f (f.key)}
							<Tabs.Trigger value={f.key}>
								{f.name} <span class="tabular-nums opacity-60">{tally[f.key]}</span>
							</Tabs.Trigger>
						{/each}
					</Tabs.List>
				</Tabs.Root>
			{/if}
		{/snippet}
	</PageHeader>

	<RewindReport report={form?.report} />

	{#if noLessonsAnywhere}
		<div class="mt-6 rounded-xl border border-dashed px-6 py-12 text-center">
			<p class="text-sm font-medium">No Lessons yet</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Create Courses, Topics and Lessons in the Courses tab.
			</p>
		</div>
	{:else}
		<!-- The Class chips: the value lives in the query string, so a Back from a Lesson keeps
		     the filter. -->
		<FilterChips
			param="class"
			value={data.classId ?? null}
			allLabel="All Classes"
			label="Filter by Class"
			options={classOptions}
			class="-mx-6 mt-4 px-6 md:mx-0 md:px-0"
		/>

		{#if showProto}
			<PrototypeSequence {seq} layout={proto.layout} control={proto.control} />
			<PrototypeSwitcher switches={proto.switches} />
		{:else if filtered.length > 0}
			<!-- Below `md` one card per Lesson (issue #339): date, Period, Class chip, title, Topic
			     and Course, with Draft/Planned as a read-only badge. Only the title opens the Lesson
			     editor, so a tap on the rest of the card opens nothing. -->
			<ul class="mt-4 space-y-2 md:hidden">
				{#each filtered as lesson (lesson.id)}
					{@const s = lesson.occurrence}
					<li class="rounded-lg border bg-card p-3">
						<div class="flex items-center gap-2 text-xs text-muted-foreground">
							{#if s}
								<span class="font-medium text-foreground tabular-nums"
									>{formatShortWeekday(s.date)}</span
								>
								<span class="tabular-nums">P{s.period}</span>
								{@render classChip(s)}
							{:else}
								<span>Not scheduled</span>
							{/if}
							<Badge
								variant={lesson.status === 'planned' ? 'secondary' : 'outline'}
								class="ml-auto"
							>
								{lesson.status === 'planned' ? 'Planned' : 'Draft'}
							</Badge>
						</div>
						<a
							href={resolve(`/lessons/${lesson.id}`)}
							class="mt-1.5 block text-sm font-medium underline-offset-2 hover:underline"
							>{lesson.title}</a
						>
						<div class="text-xs text-muted-foreground">
							{#if lesson.topicName}
								{lesson.topicName} · {lesson.courseName}
							{:else}
								Standalone Lesson
							{/if}
						</div>
					</li>
				{/each}
			</ul>

			<!-- From `md` the whole stream is one table: one column per fact to scan. Below `xl` the
			     Topic and the Course fold under the title; below `lg` the Tags fold too. Only the
			     title opens the Lesson editor, and the Status column is as wide as its toggle, so a
			     click beside the toggle opens nothing. -->
			<table
				class="mt-4 hidden w-full table-fixed border-separate border-spacing-0 text-sm md:table"
			>
				<thead class="sticky top-0 z-10 bg-background text-left text-xs text-muted-foreground">
					<tr>
						<th scope="col" class="w-28 border-b py-2 pr-3 font-medium">Next taught</th>
						<th scope="col" class="w-20 border-b py-2 pr-3 font-medium">Class</th>
						<th scope="col" class="border-b py-2 pr-3 font-medium">Lesson</th>
						<th scope="col" class="hidden w-44 border-b py-2 pr-3 font-medium xl:table-cell">
							Topic
						</th>
						<th scope="col" class="hidden w-32 border-b py-2 pr-3 font-medium xl:table-cell">
							Course
						</th>
						<th scope="col" class="hidden w-40 border-b py-2 pr-3 font-medium lg:table-cell">
							Tags
						</th>
						<th scope="col" class="w-[7.25rem] border-b py-2 font-medium">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as lesson (lesson.id)}
						{@const s = lesson.occurrence}
						<tr class="align-top">
							<td class="border-b py-2 pr-3 whitespace-nowrap tabular-nums">
								{#if s}
									{formatShortWeekday(s.date)}
									<span class="text-muted-foreground">P{s.period}</span>
								{:else}
									<span class="text-muted-foreground">—</span>
								{/if}
							</td>
							<td class="border-b py-2 pr-3">
								{#if s}{@render classChip(s)}{/if}
							</td>
							<td class="border-b py-2 pr-3">
								<a
									href={resolve(`/lessons/${lesson.id}`)}
									class="block max-w-full truncate font-medium hover:underline">{lesson.title}</a
								>
								<div class="truncate text-xs text-muted-foreground xl:hidden">
									{#if lesson.topicName}
										{lesson.topicName} · {lesson.courseName}
									{:else}
										Standalone Lesson
									{/if}
								</div>
								<TagChips tags={lesson.tags} class="mt-1 lg:hidden" />
							</td>
							<td class="hidden border-b py-2 pr-3 xl:table-cell">
								<div class="truncate text-muted-foreground">
									{lesson.topicName ?? 'Standalone Lesson'}
								</div>
							</td>
							<td class="hidden border-b py-2 pr-3 xl:table-cell">
								<div class="truncate text-muted-foreground">{lesson.courseName ?? ''}</div>
							</td>
							<td class="hidden border-b py-2 pr-3 lg:table-cell">
								<TagChips tags={lesson.tags} />
							</td>
							<td class="border-b py-1.5">{@render statusToggle(lesson)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<div
				class="mt-4 rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground"
			>
				{#if filter === 'draft'}
					No Draft Lessons
				{:else if filter === 'planned'}
					No Planned Lessons
				{:else if data.classId}
					No upcoming Lessons for this Class
				{:else}
					No Lessons to show
				{/if}
			</div>
		{/if}
	{/if}
</div>
