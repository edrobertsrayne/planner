<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import { classTone } from '$lib/class-tone';
	import { courseHref } from '$lib/client/back';
	import { createInPlace, createThenSelect } from '$lib/client/enhance';
	import RenameableRow from '$lib/components/renameable-row.svelte';
	import ReorderButtons from '$lib/components/reorder-buttons.svelte';
	import TagChips from '$lib/components/tag-chips.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { touchTarget } from '$lib/components/ui/touch-target.js';
	import ConfirmDeleteDialog from './ConfirmDeleteDialog.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const tone = $derived(classTone(data.course.tone));
	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

	// Each create box clears itself once the write lands, so the next name can be typed straight in.
	let newTopicName = $state('');
	let newLessonTitle = $state('');

	// A delete always asks first. The dialog's form carries `confirmed`, so nothing is removed
	// before it is answered.
	let pendingDelete = $state<{ kind: 'course' | 'topic'; id: string; name: string } | null>(null);
</script>

<svelte:head><title>{data.course.name}</title></svelte:head>

{#snippet menu(label: string, onDelete: () => void, itemLabel: string)}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger
			class="{touchTarget} rounded px-1 text-muted-foreground hover:text-foreground [&_svg]:size-4"
			aria-label={label}
		>
			<EllipsisIcon />
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Item variant="destructive" onSelect={onDelete}>{itemLabel}</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/snippet}

<div class="mx-auto w-full max-w-6xl px-6 py-6">
	<a
		href={resolve('/courses')}
		class="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground pointer-coarse:min-h-11"
	>
		<ChevronLeftIcon class="size-3" />
		Back to Courses
	</a>

	<header class="flex items-start gap-2 pb-4">
		<span
			class="mt-2 size-3 shrink-0 rounded-full ring-2"
			style:background-color={tone.bg}
			style:--tw-ring-color={tone.ring}
			aria-hidden="true"
		></span>
		<div class="min-w-0 flex-1">
			<RenameableRow
				name={data.course.name}
				action="?/renameCourse"
				hidden={{ id: data.course.id }}
				heading
			/>
			<p class="mt-1 text-xs text-muted-foreground">
				{plural(data.topics.length, 'Topic')} · {plural(data.lessonTotal, 'Lesson')}
			</p>
			<p class="mt-1 text-xs text-muted-foreground">
				{#if data.classes.length}
					Taught to
					{#each data.classes as c, i (c.id)}
						{i ? ', ' : ''}<a
							href={resolve(`/classes/${c.id}`)}
							class="underline underline-offset-2 hover:text-foreground">{c.label}</a
						>
					{/each}
				{:else}
					No Class follows this Course.
				{/if}
			</p>
		</div>
		{@render menu(
			'Course actions',
			() => (pendingDelete = { kind: 'course', id: data.course.id, name: data.course.name }),
			'Delete Course'
		)}
	</header>

	{#if form?.error}
		<p role="alert" class="mb-3 text-sm text-destructive">{form.error}</p>
	{/if}

	<!-- From `xl` the Topics and the chosen Topic's Lessons sit side by side. Below it one column
	     shows at a time: the Topic list until the address names a Topic, then its Lessons. -->
	<div class="xl:grid xl:grid-cols-[20rem_minmax(0,1fr)] xl:items-start xl:gap-6">
		<section class="{data.topic ? 'hidden xl:block' : ''} rounded-lg border" aria-label="Topics">
			<ul class="divide-y">
				{#each data.topics as topic, i (topic.id)}
					<!-- The chosen Topic is marked in the Course's Tone; with none chosen the first is
					     marked, from `xl` only, because only there is it the one shown. -->
					{@const marked = data.topic ? topic.id === data.topic.id : i === 0}
					<li>
						<!-- eslint-disable svelte/no-navigation-without-resolve -- courseHref resolves it -->
						<a
							href={courseHref(data.course.id, topic.id)}
							style:--tone={tone.bg}
							class="flex items-start gap-2 border-l-4 border-transparent px-4 py-2 text-sm hover:bg-accent pointer-coarse:min-h-11 {marked
								? data.topic
									? 'border-(--tone) bg-accent'
									: 'xl:border-(--tone) xl:bg-accent'
								: ''}"
						>
							<span class="min-w-0 flex-1 break-words">{topic.name}</span>
							<span class="shrink-0 text-xs text-muted-foreground tabular-nums">
								{topic.lessonCount}
							</span>
							<ChevronRightIcon class="mt-0.5 size-4 shrink-0 text-muted-foreground xl:hidden" />
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</li>
				{/each}
				{#if !data.topics.length}
					<li class="px-4 py-3 text-sm text-muted-foreground">No Topics yet.</li>
				{/if}
			</ul>
			<form
				method="POST"
				action="?/createTopic"
				class="border-t p-3"
				use:enhance={createThenSelect(
					'topic',
					(id) => `?topic=${id}`,
					() => (newTopicName = '')
				)}
			>
				<input type="hidden" name="courseId" value={data.course.id} />
				<Input
					bind:value={newTopicName}
					name="name"
					required
					autocomplete="off"
					class="h-8 w-full"
					placeholder="New Topic name — press Enter"
				/>
			</form>
		</section>

		<section
			class="{data.topic ? '' : 'hidden xl:block'} min-w-0 rounded-lg border"
			aria-label="Lessons"
		>
			{#if !data.shown}
				<p class="p-6 text-sm text-muted-foreground">Create a Topic to add Lessons.</p>
			{:else}
				{@const shown = data.shown}
				<div class="border-b px-4 py-3">
					<a
						href={resolve(`/courses/${data.course.id}`)}
						class="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground xl:hidden pointer-coarse:min-h-11"
					>
						<ChevronLeftIcon class="size-3" />
						Topics
					</a>
					<div class="flex items-start gap-2">
						<div class="min-w-0 flex-1">
							<RenameableRow
								name={data.shown.name}
								action="?/renameTopic"
								hidden={{ id: data.shown.id }}
								heading
								level={2}
							/>
							<p class="mt-1 text-xs text-muted-foreground">
								{plural(data.lessons.length, 'Lesson')}
							</p>
							<p class="mt-1 text-[11px] text-muted-foreground">
								Changes move dates for every Class teaching this Topic
							</p>
						</div>
						{@render menu(
							'Topic actions',
							() => (pendingDelete = { kind: 'topic', id: shown.id, name: shown.name }),
							'Delete Topic'
						)}
					</div>
				</div>

				<ol class="divide-y">
					{#each data.lessons as lesson, i (lesson.id)}
						{@const tags = data.tagsByLesson.get(lesson.id) ?? []}
						<li class="group flex items-start gap-3 py-1 pl-4">
							<span class="w-5 shrink-0 pt-2 font-mono text-xs text-muted-foreground/60">
								{i + 1}
							</span>
							<div class="min-w-0 flex-1 py-1 text-sm">
								<a
									href={resolve(`/lessons/${lesson.id}`)}
									class="inline-block break-words hover:underline pointer-coarse:min-h-11 pointer-coarse:py-2"
									>{lesson.title}</a
								>
								<TagChips {tags} class="mt-1" />
							</div>
							<Badge variant={lesson.status === 'planned' ? 'secondary' : 'outline'} class="mt-2">
								{lesson.status === 'planned' ? 'Planned' : 'Draft'}
							</Badge>
							<span class="flex shrink-0 items-center gap-0.5 pr-2 row-control">
								<ReorderButtons
									action="?/moveLesson"
									fields={{ topicId: data.shown.id, id: lesson.id }}
									label={lesson.title}
									first={i === 0}
									last={i === data.lessons.length - 1}
								/>
							</span>
						</li>
					{/each}
					{#if !data.lessons.length}
						<li class="px-4 py-4 text-sm text-muted-foreground">No Lessons yet.</li>
					{/if}
				</ol>

				<form
					method="POST"
					action="?/createLesson"
					class="border-t px-4 py-3"
					use:enhance={createInPlace(() => (newLessonTitle = ''))}
				>
					<input type="hidden" name="topicId" value={data.shown.id} />
					<Input
						bind:value={newLessonTitle}
						name="title"
						required
						autocomplete="off"
						class="h-8 w-full"
						placeholder="New Lesson title — press Enter"
					/>
					<p class="mt-1.5 text-[11px] text-muted-foreground">
						Title alone is a complete Lesson. Add notes and links whenever.
					</p>
				</form>
			{/if}
		</section>
	</div>
</div>

<ConfirmDeleteDialog
	bind:target={pendingDelete}
	action={pendingDelete?.kind === 'topic' ? '?/deleteTopic' : '?/deleteCourse'}
	description={pendingDelete?.kind === 'topic'
		? 'Deleting it removes the Lessons it holds.'
		: 'Deleting it removes its Topics and their Lessons.'}
/>
