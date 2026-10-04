<!--
	PROTOTYPE ONLY (issue #306). Variant C — departs from the steer: no tiles. Courses opens on a
	Course, and a row of Course names switches between them. The whole Course is one outline:
	each Topic a section that folds, its Lessons under it. On a laptop a contents list on the right
	stays in view and jumps to each Topic.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { SvelteSet } from 'svelte/reactivity';
	import { Button } from '$lib/components/ui/button';
	import CreateInput from './CreateInput.svelte';
	import ImportButton from './ImportButton.svelte';
	import InlineName from './InlineName.svelte';
	import ItemMenu from './ItemMenu.svelte';
	import LessonRows from './LessonRows.svelte';
	import { addCourse, addTopic, current, lessonCount, removeAt, store, to } from './store.svelte';

	const course = $derived(current.course ?? store.courses[0] ?? null);
	const folded = new SvelteSet<string>();
	let adding = $state(false);
</script>

<div class="mx-auto max-w-7xl px-6 py-6">
	<div class="mb-5 flex flex-wrap items-center gap-2">
		<h1 class="mr-2 text-lg font-semibold tracking-tight">Courses</h1>
		<div class="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
			{#each store.courses as c (c.id)}
				<a
					href={to({ course: c.id })}
					class="rounded-md px-3 py-1 text-sm {c.id === course?.id
						? 'bg-background font-medium shadow-sm'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					{c.name}
				</a>
			{/each}
		</div>
		{#if adding}
			<CreateInput
				class="w-64"
				placeholder="New Course name — press Enter"
				oncreate={(v) => {
					adding = false;
					goto(to({ course: addCourse(v).id }));
				}}
			/>
		{:else}
			<Button variant="ghost" size="sm" class="max-md:hidden" onclick={() => (adding = true)}>
				+ New Course
			</Button>
		{/if}
	</div>

	{#if course}
		<div class="grid gap-8 lg:grid-cols-[1fr_16rem]">
			<div class="min-w-0">
				<div class="mb-4 flex items-start gap-3 border-b pb-4">
					<div class="min-w-0 flex-1">
						<InlineName
							value={course.name}
							class="text-xl font-semibold"
							inputClass="h-9 w-80 text-lg font-semibold"
							onsave={(v) => (course.name = v)}
						/>
						<p class="mt-1 text-sm text-muted-foreground">
							{course.topics.length} Topics · {lessonCount(course)} Lessons ·
							{course.classes.length ? `Taught to ${course.classes.join(', ')}` : 'No Classes yet'}
						</p>
					</div>
					<Button
						variant="ghost"
						size="sm"
						onclick={() =>
							folded.size ? folded.clear() : course.topics.forEach((t) => folded.add(t.id))}
					>
						{folded.size ? 'Unfold all' : 'Fold all'}
					</Button>
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
				</div>

				<div class="space-y-4">
					{#each course.topics as t (t.id)}
						{@const open = !folded.has(t.id)}
						<section id="topic-{t.id}" class="scroll-mt-4 rounded-lg border">
							<div class="flex items-start gap-2 px-3 py-2.5 {open ? 'border-b' : ''}">
								<button
									type="button"
									class="mt-0.5 rounded p-0.5 text-muted-foreground hover:bg-muted"
									aria-label={open ? `Fold ${t.name}` : `Unfold ${t.name}`}
									onclick={() => (open ? folded.add(t.id) : folded.delete(t.id))}
								>
									{#if open}<ChevronDownIcon class="size-4" />{:else}<ChevronRightIcon
											class="size-4"
										/>{/if}
								</button>
								<h2 class="min-w-0 flex-1 font-semibold">
									<InlineName value={t.name} onsave={(v) => (t.name = v)} />
								</h2>
								<span class="shrink-0 pt-0.5 text-xs text-muted-foreground">
									{t.lessons.length} Lessons
								</span>
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
							</div>
							{#if open}
								<div class="py-1 pb-3">
									<LessonRows {course} topic={t} />
								</div>
							{/if}
						</section>
					{/each}
				</div>
				<CreateInput
					class="pt-4"
					placeholder="New Topic name — press Enter"
					oncreate={(v) => addTopic(course, v)}
				/>
			</div>

			<!-- Contents: stays in view on a laptop. -->
			<nav class="max-lg:hidden" aria-label="Topics in this Course">
				<div class="sticky top-6">
					<h2 class="pb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
						In this Course
					</h2>
					<ol class="space-y-1 border-l text-sm">
						{#each course.topics as t (t.id)}
							<li>
								<a
									href="#topic-{t.id}"
									onclick={() => folded.delete(t.id)}
									class="-ml-px block border-l border-transparent py-0.5 pl-3 text-muted-foreground hover:border-foreground hover:text-foreground"
								>
									{t.name}
								</a>
							</li>
						{/each}
					</ol>
				</div>
			</nav>
		</div>
	{:else}
		<p class="text-sm text-muted-foreground">No Courses yet.</p>
	{/if}
</div>
