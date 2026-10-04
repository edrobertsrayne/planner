<!--
	PROTOTYPE ONLY (issue #306). Variant D — departs from the steer: one screen, no tiles. A tree
	on the left holds every Course with its Topics folded under it; the chosen Topic's Lessons
	take the rest of the width. Below `lg` the tree moves behind a "Browse" button into a sheet.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ListTreeIcon from '@lucide/svelte/icons/list-tree';
	import { SvelteSet } from 'svelte/reactivity';
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';
	import CreateInput from './CreateInput.svelte';
	import ImportButton from './ImportButton.svelte';
	import InlineName from './InlineName.svelte';
	import ItemMenu from './ItemMenu.svelte';
	import LessonRows from './LessonRows.svelte';
	import { addCourse, addTopic, current, removeAt, store, to } from './store.svelte';

	const course = $derived(current.course);
	const topic = $derived(current.topic);
	const open = new SvelteSet<string>(store.courses.slice(0, 1).map((c) => c.id));
	$effect(() => {
		if (course) open.add(course.id);
	});
	let sheet = $state(false);
</script>

{#snippet tree()}
	<ul class="space-y-0.5 text-sm">
		{#each store.courses as c (c.id)}
			{@const expanded = open.has(c.id)}
			<li>
				<div class="group flex items-center gap-1">
					<button
						type="button"
						class="rounded p-1 text-muted-foreground hover:bg-muted"
						aria-label={expanded ? `Fold ${c.name}` : `Unfold ${c.name}`}
						onclick={() => (expanded ? open.delete(c.id) : open.add(c.id))}
					>
						{#if expanded}<ChevronDownIcon class="size-4" />{:else}<ChevronRightIcon
								class="size-4"
							/>{/if}
					</button>
					<span class="min-w-0 flex-1 py-1 font-semibold">
						<InlineName value={c.name} onsave={(v) => (c.name = v)} />
					</span>
					<span class="opacity-0 group-hover:opacity-100 focus-within:opacity-100">
						<ItemMenu
							label="More for {c.name}"
							items={[
								{
									label: 'Delete Course',
									hint: 'Removes its Topics and Lessons too',
									destructive: true,
									onclick: () => {
										if (confirm(`Delete ${c.name}?`)) {
											removeAt(store.courses, c.id);
											if (c.id === course?.id) goto(to());
										}
									}
								}
							]}
						/>
					</span>
				</div>
				{#if expanded}
					<ul class="mb-2 ml-3 space-y-0.5 border-l pl-2">
						{#each c.topics as t (t.id)}
							<li>
								<a
									href={to({ course: c.id, topic: t.id })}
									onclick={() => (sheet = false)}
									class="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted {t.id ===
									topic?.id
										? 'bg-muted font-medium'
										: 'text-muted-foreground'}"
								>
									<span class="min-w-0 flex-1">{t.name}</span>
									<span class="shrink-0 text-xs tabular-nums">{t.lessons.length}</span>
								</a>
							</li>
						{/each}
						<li>
							<CreateInput
								class="pt-1"
								placeholder="New Topic — Enter"
								oncreate={(v) => goto(to({ course: c.id, topic: addTopic(c, v).id }))}
							/>
						</li>
					</ul>
				{/if}
			</li>
		{/each}
	</ul>
	<CreateInput
		class="pt-3"
		placeholder="New Course name — press Enter"
		oncreate={(v) => {
			const c = addCourse(v);
			open.add(c.id);
		}}
	/>
{/snippet}

<div class="flex min-h-screen">
	<aside class="w-80 shrink-0 border-r px-3 py-6 max-lg:hidden">
		<div class="mb-3 flex items-center justify-between px-1">
			<h1 class="text-lg font-semibold tracking-tight">Courses</h1>
			<ImportButton variant="ghost" />
		</div>
		{@render tree()}
	</aside>

	<main class="min-w-0 flex-1 px-6 py-6">
		<Sheet.Root bind:open={sheet}>
			<Sheet.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="outline"
						size="sm"
						class="mb-4 lg:hidden {topic ? '' : 'hidden'}"
					>
						<ListTreeIcon />Browse Courses
					</Button>
				{/snippet}
			</Sheet.Trigger>
			<Sheet.Content side="left" class="w-80 overflow-y-auto px-3 py-6">
				<Sheet.Title class="px-1 pb-3">Courses</Sheet.Title>
				{@render tree()}
			</Sheet.Content>
		</Sheet.Root>

		{#if course && topic}
			<div class="mx-auto max-w-4xl">
				<p class="text-sm text-muted-foreground">{course.name}</p>
				<div class="mt-1 mb-4 flex items-start gap-3">
					<h2 class="min-w-0 flex-1 text-xl font-semibold">
						<InlineName
							value={topic.name}
							inputClass="h-9 w-[32rem] max-w-full text-lg font-semibold"
							onsave={(v) => (topic.name = v)}
						/>
					</h2>
					<ImportButton courseName={course.name} />
					<ItemMenu
						label="More for {topic.name}"
						items={[
							{
								label: 'Delete Topic',
								hint: 'Removes its Lessons too',
								destructive: true,
								onclick: () => {
									if (confirm(`Delete ${topic.name}?`)) {
										removeAt(course.topics, topic.id);
										goto(to({ course: course.id }));
									}
								}
							}
						]}
					/>
				</div>
				<p class="mb-3 text-xs text-muted-foreground">
					{topic.lessons.length} Lessons. Changes move dates for every Class teaching this Topic.
				</p>
				<div class="rounded-lg border py-2 pb-4">
					<LessonRows {course} {topic} />
				</div>
			</div>
		{:else}
			<div class="lg:hidden">{@render tree()}</div>
			<div
				class="mx-auto mt-10 max-w-md rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground max-lg:hidden"
			>
				Pick a Topic in the tree to see its Lessons.
			</div>
		{/if}
	</main>
</div>
