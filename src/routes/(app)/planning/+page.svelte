<script lang="ts">
	import { enhance } from '$app/forms';
	import { classTone } from '$lib/class-tone';
	import { replaceQuery } from '$lib/client/enhance';
	import { openSession } from '$lib/client/session-panel.svelte';
	import { formatShortWeekday } from '$lib/date';
	import { statusTone, type PlanningStatus } from '$lib/feedback-tone';
	import AtRiskAlert from '$lib/components/at-risk-alert.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import PlacementsMovedAlert from '$lib/components/placements-moved-alert.svelte';
	import TagChips from '$lib/components/tag-chips.svelte';
	import * as Select from '$lib/components/ui/select/index.js';
	import LessonEditor from '../courses/LessonEditor.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Filter = 'all' | PlanningStatus;
	type PageSize = 10 | 25 | 50 | 'all';

	const FILTERS: { key: Filter; name: string }[] = [
		{ key: 'all', name: 'All' },
		{ key: 'draft', name: 'Draft' },
		{ key: 'planned', name: 'Planned' }
	];

	const SIZES: { value: PageSize; label: string }[] = [
		{ value: 10, label: 'Show 10' },
		{ value: 25, label: 'Show 25' },
		{ value: 50, label: 'Show 50' },
		{ value: 'all', label: 'Show all' }
	];

	const RUNGS: { key: PlanningStatus; name: string }[] = [
		{ key: 'planned', name: 'Planned' },
		{ key: 'draft', name: 'Draft' }
	];

	let filter = $state<Filter>('all');
	let size = $state<PageSize>(10);

	const tally = $derived({
		all: data.stream.length,
		draft: data.stream.filter((l) => l.status === 'draft').length,
		planned: data.stream.filter((l) => l.status === 'planned').length
	});

	const filtered = $derived(
		filter === 'all' ? data.stream : data.stream.filter((l) => l.status === filter)
	);

	const visible = $derived(size === 'all' ? filtered : filtered.slice(0, size));

	const ALL_CLASSES = 'all';

	// The one place the page's URL is built. The Class filter lives in it, so opening and closing
	// a Lesson keeps the filter.
	function href(classId: string | undefined, lessonId: string | null) {
		const query = [classId && `class=${classId}`, lessonId && `lesson=${lessonId}`].filter(Boolean);
		return query.length > 0 ? `?${query.join('&')}` : '/planning';
	}

	const hrefFor = (lessonId: string | null) => href(data.classId, lessonId);

	const setClass = (classId: string) =>
		replaceQuery(href(classId === ALL_CLASSES ? undefined : classId, null));
</script>

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
		<div class="mt-6 flex flex-wrap items-center justify-between gap-2">
			<div class="flex flex-wrap items-center gap-2">
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

			<div
				class="flex items-center gap-1 rounded-md border p-0.5 text-xs"
				role="group"
				aria-label="Page size"
			>
				{#each SIZES as s (s.label)}
					<button
						type="button"
						aria-pressed={size === s.value}
						class="rounded px-2 py-1 font-medium transition-colors {size === s.value
							? 'bg-primary text-primary-foreground'
							: 'hover:bg-muted'}"
						onclick={() => (size = s.value)}
					>
						{s.label}
					</button>
				{/each}
			</div>
		</div>

		{#if visible.length > 0}
			<ul class="mt-4 space-y-2">
				{#each visible as lesson (lesson.id)}
					{@const s = lesson.occurrence}
					{@const placed = !lesson.topicName}
					<li class="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
						<div class="flex w-28 shrink-0 flex-col items-end gap-0.5">
							{#if s}
								{@const tone = classTone(s.tone)}
								<div class="text-sm font-medium tabular-nums">{formatShortWeekday(s.date)}</div>
								<div class="flex items-center gap-1.5">
									<span class="text-xs text-muted-foreground tabular-nums">P{s.period}</span>
									<span
										class="rounded-2xl px-2 py-0.5 text-xs font-medium"
										style:background-color={tone.bg}
										style:color={tone.fg}
									>
										{s.label}
									</span>
								</div>
							{:else}
								<div class="text-sm text-muted-foreground">—</div>
								<div class="text-xs text-muted-foreground">unscheduled</div>
							{/if}
						</div>

						<div class="h-8 w-px bg-border"></div>

						<div class="min-w-0 flex-1">
							{#if placed && !s}
								<span class="block max-w-full truncate text-sm font-medium">{lesson.title}</span>
							{:else}
								<button
									type="button"
									class="block max-w-full truncate text-left text-sm font-medium hover:underline"
									onclick={() =>
										placed && s
											? openSession({ classId: s.classId, date: s.date, period: s.period })
											: replaceQuery(hrefFor(lesson.id))}
								>
									{lesson.title}
								</button>
							{/if}
							<div class="truncate text-xs text-muted-foreground">
								{#if lesson.topicName}
									{lesson.topicName} · {lesson.courseName}
								{:else}
									Standalone Lesson
								{/if}
							</div>
							<TagChips tags={lesson.tags} class="mt-1" />
						</div>

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
					</li>
				{/each}
			</ul>
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

		{#if size !== 'all' && filtered.length > visible.length}
			<p class="pt-3 text-center text-xs text-muted-foreground">
				Showing {visible.length} of {filtered.length}
			</p>
		{/if}
	{/if}
</div>

{#if data.lesson && data.course && data.topic}
	<LessonEditor
		lesson={data.lesson}
		links={data.links}
		tags={data.tags}
		existingTagNames={data.existingTagNames}
		attachments={data.attachments}
		index={data.lessonIndex}
		count={data.lessons.length}
		previousId={data.lessonIndex > 0 ? data.lessons[data.lessonIndex - 1].id : null}
		nextId={data.lessonIndex < data.lessons.length - 1
			? data.lessons[data.lessonIndex + 1].id
			: null}
		topicId={data.topic.id}
		topics={data.topics}
		taughtBy={data.taughtBy}
		{hrefFor}
	/>
{/if}
