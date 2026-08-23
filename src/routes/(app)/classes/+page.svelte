<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { sessionPanel } from '$lib/client/session-panel.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const fmtLong = (iso: string) =>
		new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		});

	let newLabel = $state('');
	let newCourse = $state('');
	$effect(() => {
		if (!data.courses.some((c) => c.id === newCourse)) newCourse = data.courses[0]?.id ?? '';
	});
</script>

<svelte:head><title>Classes</title></svelte:head>

<div class="mx-auto max-w-4xl px-6 py-6">
	<div class="mb-5 flex flex-wrap items-baseline justify-between gap-3">
		<h2 class="text-lg font-semibold tracking-tight">Classes</h2>

		<form
			method="POST"
			action="?/createClass"
			class="flex items-center gap-1.5"
			use:enhance={() => {
				return async ({ formElement, result }) => {
					const created =
						result.type === 'success' && (result.data as { class?: { id: string } })?.class;
					if (created) {
						formElement.reset();
						newLabel = '';
						// eslint-disable-next-line svelte/no-navigation-without-resolve -- carries a query string
						await goto(`/classes/${created.id}`);
					} else {
						formElement.reset();
					}
				};
			}}
		>
			<input
				name="label"
				required
				autocomplete="off"
				bind:value={newLabel}
				class="w-32 rounded border border-neutral-300 px-2 py-1 text-sm focus:border-neutral-900 focus:outline-none"
				placeholder="9B/Sc1"
			/>
			<select
				name="courseId"
				bind:value={newCourse}
				class="rounded border border-neutral-300 px-2 py-1 text-xs"
			>
				{#each data.courses as course (course.id)}
					<option value={course.id}>{course.name}</option>
				{/each}
			</select>
			<button
				type="submit"
				class="rounded bg-neutral-900 px-2 py-1 text-xs text-white disabled:opacity-40"
				disabled={!data.courses.length}
			>
				Create Class
			</button>
		</form>
	</div>
	{#if !data.courses.length}
		<p class="mb-4 text-xs text-neutral-400">Write a Course first.</p>
	{/if}
	{#if form?.error}
		<p role="alert" class="mb-4 text-xs text-neutral-500">{form.error}</p>
	{/if}

	{#if data.lanes.length === 0}
		<p class="text-sm text-neutral-400">No Classes yet — create one above.</p>
	{/if}

	<ul class="space-y-3">
		{#each data.lanes as lane (lane.classId)}
			<li class="rounded-lg bg-white p-4 ring-1 ring-neutral-200">
				<div class="flex flex-wrap items-baseline justify-between gap-2">
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- static internal route -->
					<a href={`/classes/${lane.classId}`} class="text-sm font-semibold hover:underline">
						{lane.classLabel}
					</a>
					<span class="text-xs text-neutral-500">
						{lane.taught} / {lane.total} Lessons taught
					</span>
				</div>

				<div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
					<div
						class="h-full bg-neutral-900"
						style:width="{lane.total ? Math.round((lane.taught / lane.total) * 100) : 0}%"
					></div>
				</div>

				<div class="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-xs">
					{#if lane.lastTaught}
						{@const lt = lane.lastTaught}
						<button
							type="button"
							class="text-left text-neutral-600 hover:text-neutral-900"
							onclick={() =>
								sessionPanel.open({ classId: lane.classId, date: lt.date, period: lt.period })}
						>
							<span class="text-neutral-400">Last taught:</span>
							<span class="font-medium">{lt.title}</span>
							{#if lt.note}<span class="text-neutral-400"> — {lt.note}</span>{/if}
						</button>
					{:else}
						<span class="text-neutral-400">Not taught yet.</span>
					{/if}
					{#if lane.nextUp}
						<span class="text-neutral-600">
							<span class="text-neutral-400">Next up:</span>
							<span class="font-medium">{lane.nextUp.title}</span>
						</span>
					{/if}
				</div>

				<div class="mt-2 text-xs text-neutral-600">
					<span class="text-neutral-400">Runway:</span>
					<span class="font-medium"
						>{lane.runway.date ? fmtLong(lane.runway.date) : 'open-ended'}</span
					>
					{#if lane.runway.lessonsRemaining > 0}
						<span class="text-neutral-400"
							>({lane.runway.lessonsRemaining} Lesson{lane.runway.lessonsRemaining === 1 ? '' : 's'} with
							no Slot left to carry them)</span
						>
					{/if}
				</div>

				{#if data.courseTopics[lane.courseId]?.length}
					<form
						method="POST"
						action="?/assignTopic"
						class="mt-3 flex items-center gap-2"
						use:enhance={() =>
							async ({ update }) =>
								update({ invalidateAll: true })}
					>
						<input type="hidden" name="classId" value={lane.classId} />
						<select name="topicId" class="rounded border border-neutral-300 px-2 py-1 text-xs">
							{#each data.courseTopics[lane.courseId] as t (t.id)}
								<option value={t.id}>{t.name}</option>
							{/each}
						</select>
						<button type="submit" class="rounded bg-neutral-900 px-2 py-1 text-xs text-white">
							Assign next
						</button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
</div>
