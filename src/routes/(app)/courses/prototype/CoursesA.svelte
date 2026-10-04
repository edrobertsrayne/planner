<!--
	PROTOTYPE ONLY (issue #306). Variant A: Course tiles, then a page per Course with its Topics
	beside the chosen Topic's Lessons. Below `lg` the Course page drills: Topics, then Lessons.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PageHeader from '$lib/components/page-header.svelte';
	import { Button } from '$lib/components/ui/button';
	import CreateInput from './CreateInput.svelte';
	import ImportButton from './ImportButton.svelte';
	import InlineName from './InlineName.svelte';
	import ItemMenu from './ItemMenu.svelte';
	import LessonRows from './LessonRows.svelte';
	import {
		addCourse,
		addTopic,
		current,
		lessonCount,
		plannedCount,
		removeAt,
		store,
		to
	} from './store.svelte';

	const course = $derived(current.course);
	const chosen = $derived(current.topic);
	// On a laptop the first Topic shows when none is chosen; below `lg` the Topic list shows instead.
	const shown = $derived(chosen ?? course?.topics[0] ?? null);
	let newCourse = $state(false);
</script>

{#if !course}
	<div class="mx-auto max-w-5xl px-6 py-6">
		<PageHeader title="Courses" description="Pick a Course to write its Topics and Lessons.">
			{#snippet actions()}<ImportButton />{/snippet}
		</PageHeader>
		<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each store.courses as c (c.id)}
				{@const total = lessonCount(c)}
				{@const pct = total ? Math.round((plannedCount(c) / total) * 100) : 0}
				<li class="flex flex-col overflow-hidden rounded-xl border bg-card">
					<a href={to({ course: c.id })} class="flex flex-1 flex-col gap-3 p-4 hover:bg-muted/30">
						<div>
							<div class="text-sm font-semibold">{c.name}</div>
							<div class="text-xs text-muted-foreground">
								{c.topics.length} Topics · {total} Lessons
							</div>
						</div>
						<div
							class="h-1 overflow-hidden rounded-full bg-muted"
							aria-label="{pct}% of Lessons Planned"
						>
							<div class="h-full bg-primary/60" style:width="{pct}%"></div>
						</div>
						<div class="mt-auto text-xs text-muted-foreground">
							{c.classes.length ? `Taught to ${c.classes.join(', ')}` : 'No Classes yet'}
						</div>
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
		<PageHeader>
			<InlineName
				value={course.name}
				class="text-lg font-semibold tracking-tight"
				inputClass="h-9 w-80 text-lg font-semibold"
				onsave={(v) => (course.name = v)}
			/>
			<p class="mt-1 text-sm text-muted-foreground">
				{course.topics.length} Topics · {lessonCount(course)} Lessons ·
				{course.classes.length ? `Taught to ${course.classes.join(', ')}` : 'No Classes yet'}
			</p>
			{#snippet actions()}
				<ImportButton courseName={course.name} />
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

		<div class="grid gap-6 lg:grid-cols-[20rem_1fr]">
			<!-- Topics -->
			<section class={chosen ? 'max-lg:hidden' : ''} aria-label="Topics">
				<h2 class="px-3 pb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
					Topics
				</h2>
				<ul class="space-y-0.5">
					{#each course.topics as t (t.id)}
						<li>
							<a
								href={to({ course: course.id, topic: t.id })}
								class="flex items-start gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted {t.id ===
								shown?.id
									? 'lg:bg-muted lg:font-medium'
									: ''}"
							>
								<span class="min-w-0 flex-1">{t.name}</span>
								<span class="shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums">
									{t.lessons.length}
								</span>
								<ChevronRightIcon class="size-4 shrink-0 text-muted-foreground lg:hidden" />
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
				<section class="min-w-0 rounded-lg border {chosen ? '' : 'max-lg:hidden'}">
					<div class="flex items-start gap-3 border-b px-4 py-3">
						<div class="min-w-0 flex-1">
							<Button
								variant="ghost"
								size="sm"
								class="mb-1 -ml-2 lg:hidden"
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
