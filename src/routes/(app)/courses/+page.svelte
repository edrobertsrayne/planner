<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { classTone } from '$lib/class-tone';
	import { createThenSelect } from '$lib/client/enhance';
	import PageHeader from '$lib/components/page-header.svelte';
	import { Input } from '$lib/components/ui/input/index.js';
	import { MediaQuery } from 'svelte/reactivity';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// The create box clears itself once the write lands, so the next name can be typed straight in.
	let newCourseName = $state('');

	// From `md` up the plan is written; below it, it is read, so the New Course tile is not there.
	const wide = new MediaQuery('min-width: 768px', true);
</script>

<svelte:head><title>Courses</title></svelte:head>

<div class="mx-auto w-full max-w-6xl px-6 py-6">
	<PageHeader title="Courses" />

	{#if form?.error}
		<p role="alert" class="mb-3 text-sm text-destructive">{form.error}</p>
	{/if}

	<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.courses as course (course.id)}
			{@const tone = classTone(course.tone)}
			{@const percent = course.lessonCount
				? Math.round((course.plannedCount / course.lessonCount) * 100)
				: 0}
			<li class="rounded-xl border bg-card">
				<a
					href={resolve(`/courses/${course.id}`)}
					class="flex h-full flex-col gap-3 rounded-xl p-4 hover:bg-accent"
				>
					<span class="flex items-start gap-3">
						<span
							class="mt-1 size-2.5 shrink-0 rounded-full ring-2"
							style:background-color={tone.bg}
							style:--tw-ring-color={tone.ring}
							aria-hidden="true"
						></span>
						<span class="min-w-0">
							<span class="block text-sm font-semibold">{course.name}</span>
							<span class="block text-xs text-muted-foreground">
								{course.topicCount} Topics · {course.lessonCount} Lessons
							</span>
						</span>
					</span>
					<span
						class="h-1 overflow-hidden rounded-full bg-muted"
						role="img"
						aria-label="{percent}% of Lessons Planned"
					>
						<span class="block h-full" style:width="{percent}%" style:background-color={tone.ring}
						></span>
					</span>
					<span class="mt-auto text-xs text-muted-foreground">
						{course.classes.length ? `Taught to ${course.classes.join(', ')}` : 'No Classes yet'}
					</span>
					<span class="text-xs font-medium">Open Course</span>
				</a>
			</li>
		{/each}
		{#if !data.courses.length}
			<li class="px-2 py-1.5 text-xs text-muted-foreground">No Courses yet.</li>
		{/if}
		{#if wide.current}
			<li class="rounded-xl border border-dashed p-4">
				<form
					method="POST"
					action="?/createCourse"
					use:enhance={createThenSelect(
						'course',
						(id) => resolve(`/courses/${id}`),
						() => (newCourseName = '')
					)}
				>
					<Input
						bind:value={newCourseName}
						name="name"
						required
						autocomplete="off"
						class="h-8 w-full"
						placeholder="New Course name — press Enter"
					/>
				</form>
			</li>
		{/if}
	</ul>
</div>
