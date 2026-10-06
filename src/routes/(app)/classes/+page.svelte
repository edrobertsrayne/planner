<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { classTone } from '$lib/class-tone';
	import { formatDateShort } from '$lib/date';
	import { onFail, submitWithValue } from '$lib/client/enhance';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import AtRiskAlert from '$lib/components/at-risk-alert.svelte';
	import PlacementsMovedAlert from '$lib/components/placements-moved-alert.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select/index.js';
	import NewClassDialog from './NewClassDialog.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// One form per tile, found by its Class — the Select picks the Topic and submits on the pick,
	// so the trigger stays a plain "Assign next Topic" affordance rather than growing a button.
	const assignForms: Record<string, HTMLFormElement> = {};

	const courseName = (courseId: string) => data.courses.find((c) => c.id === courseId)?.name ?? '';
</script>

<svelte:head><title>Classes</title></svelte:head>

<div class="mx-auto max-w-6xl px-6 py-6">
	<PageHeader title="Classes" />

	{#if form?.atRisk}
		<AtRiskAlert atRisk={form.atRisk} />
	{/if}
	{#if form?.placementsMoved}
		<PlacementsMovedAlert placementsMoved={form.placementsMoved} />
	{/if}

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
				{@const pct = lane.total ? Math.round((lane.taught / lane.total) * 100) : 0}
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

						<span
							class="h-1 overflow-hidden rounded-full bg-muted"
							role="progressbar"
							aria-valuenow={pct}
							aria-valuemin={0}
							aria-valuemax={100}
							aria-label={`${lane.classLabel}: ${lane.taught} of ${lane.total} Lessons taught`}
						>
							<span class="block h-full" style:width="{pct}%" style:background-color={tone.ring}
							></span>
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
								<dd class="min-w-0 tabular-nums">
									{lane.runway.date ? formatDateShort(lane.runway.date) : 'open-ended'}
								</dd>
							</div>
						</dl>
					</a>

					<div class="flex items-center gap-1 border-t px-2 py-1.5">
						{#if data.courseTopics[lane.courseId]?.length}
							<form
								method="POST"
								action="?/assignTopic"
								class="min-w-0 flex-1 max-md:hidden"
								bind:this={assignForms[lane.classId]}
								use:enhance={onFail('Could not assign the Topic.')}
							>
								<input type="hidden" name="classId" value={lane.classId} />
								<input type="hidden" name="topicId" />
								<Select.Root
									type="single"
									onValueChange={(value) =>
										submitWithValue(assignForms[lane.classId], 'topicId', value)}
								>
									<Select.Trigger
										size="sm"
										class="w-full min-w-0 justify-start border-0 bg-transparent px-2 text-xs text-muted-foreground"
									>
										Assign next Topic
									</Select.Trigger>
									<Select.Content>
										{#each data.courseTopics[lane.courseId] as topic (topic.id)}
											<Select.Item value={topic.id} label={topic.name} />
										{/each}
									</Select.Content>
								</Select.Root>
							</form>
						{:else}
							<span class="min-w-0 flex-1 px-2 text-xs text-muted-foreground/60 max-md:hidden">
								No Topics to assign
							</span>
						{/if}
						<Button
							variant="ghost"
							size="sm"
							class="ml-auto shrink-0 px-2 text-xs"
							href={resolve(`/classes/${lane.classId}`)}
						>
							Open Class<ChevronRightIcon />
						</Button>
					</div>
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
