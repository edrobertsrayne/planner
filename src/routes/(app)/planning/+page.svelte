<script lang="ts">
	import { enhance } from '$app/forms';
	import { classTone } from '$lib/class-tone';
	import { replaceQuery } from '$lib/client/enhance';
	import { formatShortWeekday } from '$lib/date';
	import PageHeader from '$lib/components/page-header.svelte';
	import LessonEditor from '../courses/LessonEditor.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const RUNGS = [
		{ key: 'planned', name: 'Planned' },
		{ key: 'draft', name: 'Draft' }
	] as const;
</script>

<svelte:head><title>Planning</title></svelte:head>

<div class="mx-auto max-w-4xl px-6 py-6">
	<PageHeader title="Planning" description="Every Lesson in scheduled order." />

	{#if data.stream.length === 0}
		<div class="mt-6 rounded-xl border border-dashed px-6 py-12 text-center">
			<p class="text-sm font-medium">No Lessons yet</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Create Courses, Topics and Lessons in the Courses tab.
			</p>
		</div>
	{:else}
		<ul class="mt-6 space-y-2">
			{#each data.stream as lesson (lesson.id)}
				{@const s = lesson.occurrence}
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
						<button
							type="button"
							class="block max-w-full truncate text-left text-sm font-medium hover:underline"
							onclick={() => replaceQuery(`?lesson=${lesson.id}`)}
						>
							{lesson.title}
						</button>
						<div class="truncate text-xs text-muted-foreground">
							{lesson.topicName} · {lesson.courseName}
						</div>
					</div>

					<form method="POST" action="?/setLessonStatus" use:enhance class="contents">
						<input type="hidden" name="id" value={lesson.id} />
						<div class="flex shrink-0 overflow-hidden rounded-md border text-xs" role="group">
							{#each RUNGS as rung (rung.key)}
								{@const on = lesson.status === rung.key}
								<button
									type="submit"
									name="status"
									value={rung.key}
									aria-pressed={on}
									class="px-2 py-1.5 font-medium transition-colors {on
										? 'bg-primary text-primary-foreground'
										: 'text-muted-foreground hover:bg-muted'}"
								>
									{rung.name}
								</button>
							{/each}
						</div>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
</div>

{#if data.lesson && data.course && data.topic}
	<LessonEditor
		lesson={data.lesson}
		links={data.links}
		index={data.lessonIndex}
		count={data.lessons.length}
		previousId={data.lessonIndex > 0 ? data.lessons[data.lessonIndex - 1].id : null}
		nextId={data.lessonIndex < data.lessons.length - 1
			? data.lessons[data.lessonIndex + 1].id
			: null}
		courseId={data.course.id}
		topicId={data.topic.id}
		topics={data.topics}
		taughtBy={data.taughtBy}
	/>
{/if}
