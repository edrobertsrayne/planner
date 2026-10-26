<script lang="ts">
	import { resolve } from '$app/paths';
	import { classTone } from '$lib/class-tone';
	import { runwayText } from '$lib/runway';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PageHeader from '$lib/components/page-header.svelte';
	import { Button } from '$lib/components/ui/button';
	import NewClassDialog from './NewClassDialog.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const courseName = (courseId: string) => data.courses.find((c) => c.id === courseId)?.name ?? '';
</script>

<svelte:head><title>Classes</title></svelte:head>

<div class="mx-auto max-w-6xl px-6 py-6">
	<PageHeader title="Classes" />

	{#if !data.courses.length}
		<div class="mt-6 rounded-xl border border-dashed px-6 py-12 text-center">
			<p class="text-sm font-medium">No Courses yet</p>
			<p class="mt-1 text-sm text-muted-foreground">
				A Class teaches one Course. Write a Course first, then come back to create your Classes.
				<a href={resolve('/courses')} class="underline underline-offset-2">Go to Courses</a>.
			</p>
		</div>
	{:else if data.lanes.length === 0}
		<div class="mt-6 rounded-xl border border-dashed px-6 py-12 text-center">
			<p class="text-sm font-medium">No Classes yet</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Create your first Class, then timetable it onto the week it teaches.
			</p>
			<NewClassDialog courses={data.courses}>
				{#snippet trigger(props)}
					<Button {...props} size="sm" class="mt-4 max-md:hidden">
						<PlusIcon data-icon="inline-start" />New Class
					</Button>
				{/snippet}
			</NewClassDialog>
		</div>
	{:else}
		<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.lanes as lane (lane.classId)}
				{@const tone = classTone(lane.tone)}
				<!-- The tile body is one link to the Class page, as on Courses (story 107). -->
				<li class="flex flex-col overflow-hidden rounded-xl border bg-card">
					<a
						href={resolve(`/classes/${lane.classId}`)}
						class="flex flex-1 flex-col gap-3 p-4 hover:bg-accent"
					>
						<span class="flex items-start gap-3">
							<span
								class="mt-1 size-2.5 shrink-0 rounded-full ring-2"
								style:background-color={tone.bg}
								style:--tw-ring-color={tone.ring}
								aria-hidden="true"
							></span>
							<span class="min-w-0">
								<span class="block text-sm font-semibold">{lane.classLabel}</span>
								<span class="block text-xs text-muted-foreground">
									{courseName(lane.courseId)}
								</span>
							</span>
						</span>

						<dl class="mt-auto space-y-1 text-xs">
							<!-- The Topic sits above the Lesson because the Lesson is inside it: the tile reads
						     "you are in Electricity, and the next one is Resistance". -->
							<div class="flex gap-1.5">
								<dt class="shrink-0 text-muted-foreground">Topic</dt>
								<dd class="min-w-0 font-medium">{lane.nextUp?.topicName ?? '—'}</dd>
							</div>
							<div class="flex gap-1.5">
								<dt class="shrink-0 text-muted-foreground">Next</dt>
								<dd class="min-w-0">{lane.nextUp?.title ?? '—'}</dd>
							</div>
							<div class="flex gap-1.5">
								<dt class="shrink-0 text-muted-foreground">Runway</dt>
								<dd
									class="min-w-0 {lane.runway.lessonsRemaining > 0
										? 'text-destructive'
										: 'tabular-nums'}"
								>
									{runwayText(lane.runway)}
								</dd>
							</div>
						</dl>
					</a>
				</li>
			{/each}

			<!-- Nothing is written on a phone, so the New Class tile is not there (story 109). -->
			<li class="max-md:hidden">
				<NewClassDialog courses={data.courses}>
					{#snippet trigger(props)}
						<button
							{...props}
							type="button"
							class="flex h-full min-h-44 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
						>
							<PlusIcon class="size-4" />
							<span class="text-sm font-medium">New Class</span>
						</button>
					{/snippet}
				</NewClassDialog>
			</li>
		</ul>
	{/if}
</div>
