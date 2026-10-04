<!--
	PROTOTYPE ONLY (issue #306). Variant A: Course tiles, then a page per Course with its Topics
	beside the chosen Topic's Lessons. Below `xl` the Course page drills: Topics, then Lessons, so a
	1024 px window with the labelled sidebar still gives Lesson titles the full width.
	`colour` tries ways to tell Courses apart: none; a Course Tone shown as a band or as a dot; or
	no Course colour, with each Class teaching the Course shown in its own Tone.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { classTone } from '$lib/class-tone';
	import PageHeader from '$lib/components/page-header.svelte';
	import { Button } from '$lib/components/ui/button';
	import CreateInput from './CreateInput.svelte';
	import InlineName from './InlineName.svelte';
	import ItemMenu from './ItemMenu.svelte';
	import LessonRows from './LessonRows.svelte';
	import {
		CLASS_TONES,
		addCourse,
		addTopic,
		current,
		lessonCount,
		plannedCount,
		removeAt,
		store,
		to,
		type Course
	} from './store.svelte';

	let { colour = 'none' }: { colour?: 'none' | 'band' | 'dot' | 'classes' } = $props();
	const courseTone = $derived(colour === 'band' || colour === 'dot');

	const course = $derived(current.course);
	const chosen = $derived(current.topic);
	// From `xl` the first Topic shows when none is chosen; below `xl` the Topic list shows instead.
	const shown = $derived(chosen ?? course?.topics[0] ?? null);
	let newCourse = $state(false);
</script>

{#snippet classesLine(c: Course)}
	{#if !c.classes.length}
		<span class="text-xs text-muted-foreground">No Classes yet</span>
	{:else if colour === 'classes'}
		<span class="flex flex-wrap gap-1">
			{#each c.classes as label (label)}
				{@const t = classTone(CLASS_TONES[label] ?? 0)}
				<span
					class="rounded px-1.5 py-0.5 text-[11px] font-medium"
					style:background-color={t.bg}
					style:color={t.fg}>{label}</span
				>
			{/each}
		</span>
	{:else}
		<span class="text-xs text-muted-foreground">Taught to {c.classes.join(', ')}</span>
	{/if}
{/snippet}

{#snippet dot(c: Course)}
	{@const t = classTone(c.tone)}
	<span
		class="mt-1 size-2.5 shrink-0 rounded-full ring-2"
		style:background-color={t.bg}
		style:--tw-ring-color={t.ring}
		aria-hidden="true"
	></span>
{/snippet}

{#if !course}
	<div class="mx-auto max-w-5xl px-6 py-6">
		<PageHeader title="Courses" description="Pick a Course to write its Topics and Lessons." />
		<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each store.courses as c (c.id)}
				{@const total = lessonCount(c)}
				{@const pct = total ? Math.round((plannedCount(c) / total) * 100) : 0}
				{@const t = classTone(c.tone)}
				<li
					class="flex flex-col overflow-hidden rounded-xl border bg-card {colour === 'band'
						? 'border-t-4'
						: ''}"
					style:border-top-color={colour === 'band' ? t.ring : undefined}
				>
					<a href={to({ course: c.id })} class="flex flex-1 flex-col gap-3 p-4 hover:bg-muted/30">
						<div class="flex items-start gap-3">
							{#if colour === 'dot'}{@render dot(c)}{/if}
							<div class="min-w-0">
								<div class="text-sm font-semibold">{c.name}</div>
								<div class="text-xs text-muted-foreground">
									{c.topics.length} Topics · {total} Lessons
								</div>
							</div>
						</div>
						<div
							class="h-1 overflow-hidden rounded-full bg-muted"
							aria-label="{pct}% of Lessons Planned"
						>
							<div
								class="h-full {courseTone ? '' : 'bg-primary/60'}"
								style:width="{pct}%"
								style:background-color={courseTone ? t.ring : undefined}
							></div>
						</div>
						<div class="mt-auto">{@render classesLine(c)}</div>
					</a>
					<div class="flex items-center border-t px-2 py-1.5">
						<span class="flex-1 px-2 text-xs text-muted-foreground">{pct}% Planned</span>
						<Button variant="ghost" size="sm" class="px-2 text-xs" href={to({ course: c.id })}>
							Open Course<ChevronRightIcon />
						</Button>
					</div>
				</li>
			{/each}
			<li class="max-md:hidden">
				{#if newCourse}
					<div class="flex h-full min-h-40 flex-col justify-center rounded-xl border p-4">
						<CreateInput
							placeholder="New Course name — press Enter"
							oncreate={(v) => goto(to({ course: addCourse(v).id }))}
						/>
					</div>
				{:else}
					<button
						type="button"
						onclick={() => (newCourse = true)}
						class="flex h-full min-h-40 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-muted-foreground hover:bg-muted/40 hover:text-foreground"
					>
						<PlusIcon class="size-4" /><span class="text-sm font-medium">New Course</span>
					</button>
				{/if}
			</li>
		</ul>
	</div>
{:else}
	<div class="mx-auto max-w-7xl px-6 py-6">
		<Button variant="ghost" size="sm" class="mb-2 -ml-2" href={to()}>
			<ArrowLeftIcon />Courses
		</Button>
		<div
			class={colour === 'band' ? 'mb-4 rounded-lg border-l-4 px-4 pt-3' : ''}
			style:border-left-color={colour === 'band' ? classTone(course.tone).ring : undefined}
			style:background-color={colour === 'band' ? classTone(course.tone).bg : undefined}
		>
			<PageHeader>
				<div class="flex items-start gap-3">
					{#if colour === 'dot'}{@render dot(course)}{/if}
					<div class="min-w-0">
						<InlineName
							value={course.name}
							class="text-lg font-semibold tracking-tight"
							inputClass="h-9 w-80 text-lg font-semibold"
							onsave={(v) => (course.name = v)}
						/>
						<p class="mt-1 text-sm text-muted-foreground">
							{course.topics.length} Topics · {lessonCount(course)} Lessons
						</p>
						<div class="mt-1.5">{@render classesLine(course)}</div>
					</div>
				</div>
				{#snippet actions()}
					<ItemMenu
						label="More for {course.name}"
						items={[
							{
								label: 'Delete Course',
								hint: 'Removes its Topics and Lessons too',
								destructive: true,
								onclick: () => {
									if (confirm(`Delete ${course.name} and everything in it?`)) {
										removeAt(store.courses, course.id);
										goto(to());
									}
								}
							}
						]}
					/>
				{/snippet}
			</PageHeader>
		</div>

		<div class="grid gap-6 xl:grid-cols-[20rem_1fr]">
			<!-- Topics -->
			<section class={chosen ? 'max-xl:hidden' : ''} aria-label="Topics">
				<h2 class="px-3 pb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
					Topics
				</h2>
				<ul class="space-y-0.5">
					{#each course.topics as t (t.id)}
						<li>
							<a
								href={to({ course: course.id, topic: t.id })}
								class="flex items-start gap-2 rounded-md border-l-2 border-transparent px-3 py-2 text-sm hover:bg-muted {t.id ===
								shown?.id
									? 'xl:bg-muted xl:font-medium'
									: ''}"
								style:border-left-color={courseTone && t.id === shown?.id
									? classTone(course.tone).ring
									: undefined}
							>
								<span class="min-w-0 flex-1">{t.name}</span>
								<span class="shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums">
									{t.lessons.length}
								</span>
								<ChevronRightIcon class="size-4 shrink-0 text-muted-foreground xl:hidden" />
							</a>
						</li>
					{/each}
					{#if !course.topics.length}
						<li class="px-3 text-sm text-muted-foreground">No Topics yet.</li>
					{/if}
				</ul>
				<CreateInput
					class="px-3 pt-3"
					placeholder="New Topic name — press Enter"
					oncreate={(v) => goto(to({ course: course.id, topic: addTopic(course, v).id }))}
				/>
			</section>

			<!-- The chosen Topic's Lessons -->
			{#if shown}
				<section
					class="min-w-0 rounded-lg border {chosen ? '' : 'max-xl:hidden'} {colour === 'band'
						? 'border-t-4'
						: ''}"
					style:border-top-color={colour === 'band' ? classTone(course.tone).ring : undefined}
				>
					<div class="flex items-start gap-3 border-b px-4 py-3">
						<div class="min-w-0 flex-1">
							<Button
								variant="ghost"
								size="sm"
								class="mb-1 -ml-2 xl:hidden"
								href={to({ course: course.id })}
							>
								<ArrowLeftIcon />Topics
							</Button>
							<h2 class="text-base font-semibold">
								<InlineName value={shown.name} onsave={(v) => (shown.name = v)} />
							</h2>
							<p class="mt-1 text-xs text-muted-foreground">
								{shown.lessons.length} Lessons. Changes move dates for every Class teaching this Topic.
							</p>
						</div>
						<ItemMenu
							label="More for {shown.name}"
							items={[
								{
									label: 'Delete Topic',
									hint: 'Removes its Lessons too',
									destructive: true,
									onclick: () => {
										if (confirm(`Delete ${shown.name} and its Lessons?`)) {
											removeAt(course.topics, shown.id);
											goto(to({ course: course.id }));
										}
									}
								}
							]}
						/>
					</div>
					<div class="py-2 pb-4">
						<LessonRows {course} topic={shown} />
					</div>
				</section>
			{/if}
		</div>
	</div>
{/if}
