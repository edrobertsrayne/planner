<script lang="ts">
	import { enhance } from '$app/forms';
	import { classTone } from '$lib/class-tone';
	import { formatDateShort } from '$lib/date';
	import { onFail } from '$lib/client/enhance';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PageHeader from '$lib/components/page-header.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select/index.js';
	import NewClassDialog from './NewClassDialog.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// One form per tile, found by its Class — the Select picks the Topic and submits on the pick,
	// so the trigger stays a plain "Assign next Topic" affordance rather than growing a button.
	const assignForms: Record<string, HTMLFormElement> = {};

	function assignNextTopic(classId: string, topicId: string) {
		const form = assignForms[classId];
		if (!form || !topicId) return;
		(form.elements.namedItem('topicId') as HTMLInputElement).value = topicId;
		form.requestSubmit();
	}

	const courseName = (courseId: string) => data.courses.find((c) => c.id === courseId)?.name ?? '';
</script>

<svelte:head><title>Classes</title></svelte:head>

<div class="mx-auto max-w-5xl px-6 py-6">
	<PageHeader
		title="Classes"
		description="Pick a Class to timetable it, or give it its next Topic from here."
	/>

	{#if !data.courses.length}
		<div class="mt-6 rounded-xl border border-dashed px-6 py-12 text-center">
			<p class="text-sm font-medium">No Courses yet</p>
			<p class="mt-1 text-sm text-muted-foreground">
				A Class teaches one Course. Write a Course first, then come back to create your Classes.
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- static internal route -->
				<a href="/courses" class="underline underline-offset-2">Go to Courses</a>.
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
					<Button {...props} size="sm" class="mt-4">
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
				<li class="flex flex-col overflow-hidden rounded-xl border bg-card">
					<div class="flex flex-1 flex-col gap-3 p-4">
						<div class="flex items-start gap-3">
							<span
								class="mt-0.5 size-2.5 shrink-0 rounded-full ring-2"
								style:background-color={tone.bg}
								style:--tw-ring-color={tone.ring}
								aria-hidden="true"
							></span>
							<div class="min-w-0 flex-1">
								<!-- eslint-disable svelte/no-navigation-without-resolve -- carries a Class id -->
								<a
									href={`/classes/${lane.classId}`}
									class="block truncate text-sm font-semibold hover:underline"
								>
									{lane.classLabel}
								</a>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
								<div class="truncate text-xs text-muted-foreground">
									{courseName(lane.courseId)}
								</div>
							</div>
							<div class="text-right text-xs text-muted-foreground tabular-nums">{pct}%</div>
						</div>

						<div
							class="h-1 overflow-hidden rounded-full bg-muted"
							role="progressbar"
							aria-valuenow={pct}
							aria-valuemin={0}
							aria-valuemax={100}
							aria-label={`${lane.classLabel}: ${lane.taught} of ${lane.total} Lessons taught`}
						>
							<div class="h-full" style:width="{pct}%" style:background-color={tone.ring}></div>
						</div>

						<dl class="mt-auto space-y-1 text-xs">
							<!-- The Topic sits above the Lesson because the Lesson is inside it: the tile reads
							     "you are in Electricity, and the next one is Resistance". -->
							<div class="flex gap-1.5">
								<dt class="shrink-0 text-muted-foreground">Topic</dt>
								<dd class="truncate font-medium">{lane.nextUp?.topicName ?? '—'}</dd>
							</div>
							<div class="flex gap-1.5">
								<dt class="shrink-0 text-muted-foreground">Next</dt>
								<dd class="truncate">{lane.nextUp?.title ?? '—'}</dd>
							</div>
							<div class="flex gap-1.5">
								<dt class="shrink-0 text-muted-foreground">Runway</dt>
								<dd class="truncate tabular-nums">
									{lane.runway.date ? formatDateShort(lane.runway.date) : 'open-ended'}
								</dd>
							</div>
						</dl>
					</div>

					<div class="flex items-center gap-1 border-t px-2 py-1.5">
						{#if data.courseTopics[lane.courseId]?.length}
							<form
								method="POST"
								action="?/assignTopic"
								class="min-w-0 flex-1"
								bind:this={assignForms[lane.classId]}
								use:enhance={onFail('Could not assign the Topic.')}
							>
								<input type="hidden" name="classId" value={lane.classId} />
								<input type="hidden" name="topicId" />
								<Select.Root
									type="single"
									onValueChange={(value) => assignNextTopic(lane.classId, value ?? '')}
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
							<span class="min-w-0 flex-1 px-2 text-xs text-muted-foreground/60">
								No Topics to assign
							</span>
						{/if}
						<!-- eslint-disable svelte/no-navigation-without-resolve -- carries a Class id -->
						<Button
							variant="ghost"
							size="sm"
							class="shrink-0 px-2 text-xs"
							href={`/classes/${lane.classId}`}
						>
							Open Class page<ChevronRightIcon />
						</Button>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</div>
				</li>
			{/each}

			<li>
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
