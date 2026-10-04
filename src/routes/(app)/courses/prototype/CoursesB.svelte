<!--
	PROTOTYPE ONLY (issue #306). Variant B: three levels of page. Course tiles that list their
	Topics, then a Course page of Topic cards, then a Topic page that gives the Lessons the full
	width. A breadcrumb leads back up.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PageHeader from '$lib/components/page-header.svelte';
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
		removeAt,
		store,
		to,
		type Topic
	} from './store.svelte';

	const course = $derived(current.course);
	const topic = $derived(current.topic);

	const planned = (t: Topic) => t.lessons.filter((l) => l.status === 'Planned').length;
</script>

{#snippet crumbs()}
	<nav class="mb-3 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
		<a href={to()} class="hover:text-foreground hover:underline">Courses</a>
		{#if course}
			<span>›</span>
			{#if topic}
				<a href={to({ course: course.id })} class="hover:text-foreground hover:underline">
					{course.name}
				</a>
			{:else}
				<span class="text-foreground">{course.name}</span>
			{/if}
		{/if}
	</nav>
{/snippet}

{#if !course}
	<div class="mx-auto max-w-6xl px-6 py-6">
		<PageHeader title="Courses" description="Each Course holds the Topics a Class may be given.">
			{#snippet actions()}<ImportButton />{/snippet}
		</PageHeader>
		<ul class="grid gap-4 md:grid-cols-2">
			{#each store.courses as c (c.id)}
				<li class="rounded-xl border bg-card">
					<a href={to({ course: c.id })} class="block p-5 hover:bg-muted/30">
						<div class="flex items-baseline justify-between gap-3">
							<span class="text-base font-semibold">{c.name}</span>
							<span class="shrink-0 text-xs text-muted-foreground">
								{c.classes.join(' · ') || 'No Classes'}
							</span>
						</div>
						<ol class="mt-3 space-y-1 text-sm text-muted-foreground">
							{#each c.topics.slice(0, 4) as t, i (t.id)}
								<li class="flex gap-2">
									<span class="w-4 shrink-0 text-right text-xs tabular-nums">{i + 1}</span>
									<span class="line-clamp-1" title={t.name}>{t.name}</span>
								</li>
							{/each}
							{#if c.topics.length > 4}
								<li class="pl-6 text-xs">and {c.topics.length - 4} more Topics</li>
							{/if}
							{#if !c.topics.length}
								<li class="text-xs">No Topics yet.</li>
							{/if}
						</ol>
					</a>
				</li>
			{/each}
			<li
				class="flex min-h-36 flex-col justify-center gap-2 rounded-xl border border-dashed p-5 max-md:hidden"
			>
				<span class="flex items-center gap-1 text-sm font-medium text-muted-foreground">
					<PlusIcon class="size-4" />New Course
				</span>
				<CreateInput
					placeholder="Course name — press Enter"
					oncreate={(v) => goto(to({ course: addCourse(v).id }))}
				/>
			</li>
		</ul>
	</div>
{:else if !topic}
	<div class="mx-auto max-w-4xl px-6 py-6">
		{@render crumbs()}
		<PageHeader>
			<InlineName
				value={course.name}
				class="text-lg font-semibold tracking-tight"
				inputClass="h-9 w-80 text-lg font-semibold"
				onsave={(v) => (course.name = v)}
			/>
			<p class="mt-1 text-sm text-muted-foreground">
				{course.topics.length} Topics · {lessonCount(course)} Lessons
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
								if (confirm(`Delete ${course.name}?`)) {
									removeAt(store.courses, course.id);
									goto(to());
								}
							}
						}
					]}
				/>
			{/snippet}
		</PageHeader>
		<ul class="space-y-2">
			{#each course.topics as t (t.id)}
				{@const pct = t.lessons.length ? Math.round((planned(t) / t.lessons.length) * 100) : 0}
				<li class="group flex items-start gap-3 rounded-lg border bg-card p-4 hover:bg-muted/30">
					<a href={to({ course: course.id, topic: t.id })} class="min-w-0 flex-1">
						<div class="font-medium">{t.name}</div>
						<div class="mt-1 text-xs text-muted-foreground">
							{t.lessons.length} Lessons · {planned(t)} Planned
						</div>
						<div class="mt-2 h-1 max-w-64 overflow-hidden rounded-full bg-muted">
							<div class="h-full bg-primary/60" style:width="{pct}%"></div>
						</div>
					</a>
					<span class="opacity-0 group-hover:opacity-100 focus-within:opacity-100">
						<ItemMenu
							label="More for {t.name}"
							items={[
								{
									label: 'Delete Topic',
									hint: 'Removes its Lessons too',
									destructive: true,
									onclick: () => confirm(`Delete ${t.name}?`) && removeAt(course.topics, t.id)
								}
							]}
						/>
					</span>
				</li>
			{/each}
			{#if !course.topics.length}
				<li class="text-sm text-muted-foreground">No Topics yet.</li>
			{/if}
		</ul>
		<CreateInput
			class="pt-3"
			placeholder="New Topic name — press Enter"
			oncreate={(v) => goto(to({ course: course.id, topic: addTopic(course, v).id }))}
		/>
	</div>
{:else}
	<div class="mx-auto max-w-4xl px-6 py-6">
		{@render crumbs()}
		<PageHeader>
			<InlineName
				value={topic.name}
				class="text-lg font-semibold tracking-tight"
				inputClass="h-9 w-[32rem] max-w-full text-lg font-semibold"
				onsave={(v) => (topic.name = v)}
			/>
			<p class="mt-1 text-sm text-muted-foreground">
				{topic.lessons.length} Lessons · {planned(topic)} Planned. Changes move dates for every Class
				teaching this Topic.
			</p>
			{#snippet actions()}
				<ItemMenu
					label="More for {topic.name}"
					items={[
						{
							label: 'Delete Topic',
							hint: 'Removes its Lessons too',
							destructive: true,
							onclick: () => {
								if (confirm(`Delete ${topic.name}?`)) {
									removeAt(course.topics, topic.id);
									goto(to({ course: course.id }));
								}
							}
						}
					]}
				/>
			{/snippet}
		</PageHeader>
		<div class="rounded-lg border py-2 pb-4">
			<LessonRows {course} {topic} />
		</div>
	</div>
{/if}
