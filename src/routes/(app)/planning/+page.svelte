<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { classTone } from '$lib/class-tone';
	import { replaceQuery } from '$lib/client/enhance';
	import { formatShortWeekday } from '$lib/date';
	import { statusTone, type PlanningStatus } from '$lib/feedback-tone';
	import AtRiskAlert from '$lib/components/at-risk-alert.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import PlacementsMovedAlert from '$lib/components/placements-moved-alert.svelte';
	import TagChips from '$lib/components/tag-chips.svelte';
	import * as Select from '$lib/components/ui/select/index.js';
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

	let filter = $state<Filter>('all');

	const tally = $derived({
		all: data.stream.length,
		draft: data.stream.filter((l) => l.status === 'draft').length,
		planned: data.stream.filter((l) => l.status === 'planned').length
	});

	const filtered = $derived(
		filter === 'all' ? data.stream : data.stream.filter((l) => l.status === filter)
	);

	const ALL_CLASSES = 'all';

	// The Class filter lives in the query string, so it survives a Back from a Lesson.
	function href(classId: string | undefined) {
		return classId ? `?class=${classId}` : '/planning';
	}

	const setClass = (classId: string) =>
		replaceQuery(href(classId === ALL_CLASSES ? undefined : classId));
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
	<PageHeader title="Planning" />

	{#if form?.atRisk}
		<AtRiskAlert atRisk={form.atRisk} />
	{/if}
	{#if form?.placementsMoved}
		<PlacementsMovedAlert placementsMoved={form.placementsMoved} />
	{/if}

	{#if data.stream.length === 0 && !data.classId}
		<div class="mt-6 rounded-xl border border-dashed px-6 py-12 text-center">
			<p class="text-sm font-medium">No Lessons yet</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Create Courses, Topics and Lessons in the Courses tab.
			</p>
		</div>
	{:else}
		<div class="mt-6 flex flex-wrap items-center gap-2">
			<Select.Root type="single" value={data.classId ?? ALL_CLASSES} onValueChange={setClass}>
				<Select.Trigger size="sm" class="h-7 w-40 text-xs" aria-label="Filter by Class">
					{data.classes.find((c) => c.id === data.classId)?.label ?? 'All classes'}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value={ALL_CLASSES} label="All classes" />
					{#each data.classes as c (c.id)}
						<Select.Item value={c.id} label={c.label} />
					{/each}
				</Select.Content>
			</Select.Root>

			<div class="flex items-center gap-1" role="group" aria-label="Filter by planning status">
				{#each FILTERS as f (f.key)}
					{@const on = filter === f.key}
					{@const tone = f.key === 'all' ? null : statusTone(f.key)}
					<button
						type="button"
						aria-pressed={on}
						class="rounded-full border px-3 py-1 text-xs font-medium transition-colors {on
							? 'border-transparent'
							: 'hover:bg-muted'} {on && !tone ? 'bg-primary text-primary-foreground' : ''}"
						style:background-color={on && tone ? tone.bg : undefined}
						style:color={on && tone ? tone.fg : undefined}
						onclick={() => (filter = f.key)}
					>
						{f.name} <span class="tabular-nums opacity-60">{tally[f.key]}</span>
					</button>
				{/each}
			</div>
		</div>

		{#if filtered.length > 0}
			<!-- Below `md` one card per Lesson, as it reads today. The table needs a width the phone
			     does not have; the phone card of issue #339 replaces these rows. -->
			<ul class="mt-4 space-y-2 md:hidden">
				{#each filtered as lesson (lesson.id)}
					{@const s = lesson.occurrence}
					<li class="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
						<div class="flex w-28 shrink-0 flex-col items-end gap-0.5">
							{#if s}
								<div class="text-sm font-medium tabular-nums">{formatShortWeekday(s.date)}</div>
								<div class="flex items-center gap-1.5">
									<span class="text-xs text-muted-foreground tabular-nums">P{s.period}</span>
									{@render classChip(s)}
								</div>
							{:else}
								<div class="text-sm text-muted-foreground">—</div>
								<div class="text-xs text-muted-foreground">unscheduled</div>
							{/if}
						</div>

						<div class="h-8 w-px bg-border"></div>

						<div class="min-w-0 flex-1">
							<a
								href={resolve(`/lessons/${lesson.id}`)}
								class="block max-w-full truncate text-sm font-medium hover:underline"
							>
								{lesson.title}
							</a>
							<div class="truncate text-xs text-muted-foreground">
								{#if lesson.topicName}
									{lesson.topicName} · {lesson.courseName}
								{:else}
									Standalone Lesson
								{/if}
							</div>
							<TagChips tags={lesson.tags} class="mt-1" />
						</div>

						{@render statusToggle(lesson)}
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
