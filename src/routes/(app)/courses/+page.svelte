<script lang="ts">
	import { resolve } from '$app/paths';
	import { classTone } from '$lib/class-tone';
	import PageHeader from '$lib/components/page-header.svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { plural } from '$lib/plural';
	import NewCourseDialog from './NewCourseDialog.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Courses</title></svelte:head>

<div class="mx-auto w-full max-w-6xl px-6 py-6">
	<PageHeader title="Courses" />

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
								{plural(course.topicCount, 'Topic')} · {plural(course.lessonCount, 'Lesson')}
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
		<!-- Nothing is written on a phone, so the New Course tile is not there. -->
		<li class="max-md:hidden">
			<NewCourseDialog>
				{#snippet trigger(props)}
					<button
						{...props}
						type="button"
						class="flex h-full min-h-44 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
					>
						<PlusIcon class="size-4" />
						<span class="text-sm font-medium">New Course</span>
					</button>
				{/snippet}
			</NewCourseDialog>
		</li>
	</ul>
</div>
