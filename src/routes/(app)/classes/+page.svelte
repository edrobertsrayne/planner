<script lang="ts">
	import { resolve } from '$app/paths';
	import { classTone } from '$lib/class-tone';
	import { runwayText } from '$lib/runway';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PageHeader from '$lib/components/page-header.svelte';
	import { Button } from '$lib/ui';
	import NewClassDialog from './NewClassDialog.svelte';
	import AssignTopicMenu from '$lib/components/assign-topic-menu.svelte';
	import RewindReport from '$lib/components/rewind-report.svelte';
	import { failureReason, hasReport, reportOfResult, sequenceOfResult } from '$lib/client/enhance';
	import { toast } from '$lib/ui/toast';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const courseName = (courseId: string) => data.courses.find((c) => c.id === courseId)?.name ?? '';

	// Assign Topic answers with a toast naming the Class, because the tile has no room for the
	// result; a Rewind report that moved Placements gets its own toast, as on the Lesson editor.
	const assigned =
		(classLabel: string): SubmitFunction =>
		() =>
		async ({ result, update }) => {
			if (result.type === 'failure') {
				toast.error(failureReason(result, 'Could not assign the Topic.'));
				return;
			}
			const sequence = sequenceOfResult(result);
			if (sequence) toast.success(`${classLabel}: ${sequence.lines.join(' ')}`);
			const report = reportOfResult(result);
			if (hasReport(report)) {
				toast.custom(RewindReport, { componentProps: { report }, duration: 20000 });
			}
			await update({ invalidateAll: true });
		};
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
				<li
					class="flex flex-col overflow-hidden rounded-2xl"
					style:background-color={tone.bg}
					style:color={tone.fg}
				>
					<a
						href={resolve(`/classes/${lane.classId}`)}
						class="flex flex-1 flex-col gap-3.5 p-4.5 pb-3.5 hover:brightness-95 dark:hover:brightness-110"
					>
						<span class="flex items-baseline justify-between gap-2">
							<span class="text-[22px] font-bold tracking-tight">{lane.classLabel}</span>
							<span class="text-[13px] font-medium">{courseName(lane.courseId)}</span>
						</span>

						<dl class="mt-auto grid grid-cols-[4rem_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 text-sm">
							<!-- The Topic sits above the Lesson because the Lesson is inside it: the tile reads
						     "you are in Electricity, and the next one is Resistance". -->
							<dt class="text-xs/5 font-semibold tracking-wide uppercase opacity-80">Topic</dt>
							<dd class="min-w-0 font-semibold">{lane.nextUp?.topicName ?? '—'}</dd>
							<dt class="text-xs/5 font-semibold tracking-wide uppercase opacity-80">Next</dt>
							<dd class="min-w-0">{lane.nextUp?.title ?? '—'}</dd>
							<dt class="text-xs/5 font-semibold tracking-wide uppercase opacity-80">Runway</dt>
							<dd class="min-w-0">
								<span
									class={lane.runway.lessonsRemaining > 0
										? 'inline-block rounded-md bg-surface px-2 font-semibold text-destructive'
										: 'tabular-nums'}
								>
									{runwayText(lane.runway)}
								</span>
							</dd>
						</dl>
					</a>

					<!-- Assign Topic from the list; nothing is written on a phone, so not there. -->
					<div class="flex justify-end border-t border-current/10 px-3 py-2 max-md:hidden">
						<AssignTopicMenu
							classId={lane.classId}
							topics={data.topics[lane.classId] ?? []}
							label="Assign Topic to {lane.classLabel}"
							submit={assigned(lane.classLabel)}
						/>
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
							class="flex h-full min-h-44 w-full flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-outline text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
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
