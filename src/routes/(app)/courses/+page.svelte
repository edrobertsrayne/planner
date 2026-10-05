<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { classTone } from '$lib/class-tone';
	import { createThenSelect } from '$lib/client/enhance';
	import PageHeader from '$lib/components/page-header.svelte';
	import { Input } from '$lib/components/ui/input/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// The create box clears itself once the write lands, so the next name can be typed straight in.
	let newCourseName = $state('');
</script>

<svelte:head><title>Courses</title></svelte:head>

<div class="mx-auto w-full max-w-3xl px-6 py-6">
	<PageHeader title="Courses" />

	{#if form?.error}
		<p role="alert" class="mb-3 text-sm text-destructive">{form.error}</p>
	{/if}

	<ul class="divide-y rounded-lg border">
		{#each data.courses as course (course.id)}
			{@const tone = classTone(course.tone)}
			<li>
				<a
					href={resolve(`/courses/${course.id}`)}
					class="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent pointer-coarse:min-h-11"
				>
					<span
						class="size-2.5 shrink-0 rounded-full ring-2"
						style:background-color={tone.bg}
						style:--tw-ring-color={tone.ring}
						aria-hidden="true"
					></span>
					<span class="min-w-0 flex-1">{course.name}</span>
				</a>
			</li>
		{/each}
		{#if !data.courses.length}
			<li class="px-4 py-3 text-sm text-muted-foreground">No Courses yet.</li>
		{/if}
	</ul>

	<form
		method="POST"
		action="?/createCourse"
		class="mt-3"
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
</div>
