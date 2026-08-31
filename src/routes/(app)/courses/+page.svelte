<script lang="ts">
	import { enhance } from '$app/forms';
	import { createThenSelect } from '$lib/client/enhance';
	import XIcon from '@lucide/svelte/icons/x';
	import PageHeader from '$lib/components/page-header.svelte';
	import ReorderButtons from '$lib/components/reorder-buttons.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import ConfirmDeleteDialog from './ConfirmDeleteDialog.svelte';
	import LessonEditor from './LessonEditor.svelte';
	import RenameableRow from './RenameableRow.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let courseNameInput: HTMLInputElement | null = $state(null);
	let topicNameInput: HTMLInputElement | null = $state(null);
	let lessonTitleInput: HTMLInputElement | null = $state(null);

	// A Course or Topic that still holds children — the delete form submits unconfirmed first;
	// the server answers `needsConfirm` rather than deleting, and this opens the dialog instead
	// of showing the plain error banner.
	let pendingDelete = $state<{ kind: 'course' | 'topic'; id: string; name: string } | null>(null);
</script>

<svelte:head><title>Courses</title></svelte:head>

<div class="mx-auto flex min-h-0 max-w-6xl flex-1 flex-col px-6 py-6">
	<PageHeader title="Courses" />

	{#if form?.error}
		<p role="alert" class="mb-3 text-sm text-destructive">{form.error}</p>
	{/if}

	<div class="flex min-h-0 flex-1 rounded-lg border">
		<!-- pane 1: Courses -->
		<aside class="flex w-64 shrink-0 flex-col border-r py-3">
			<h2 class="px-4 pb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
				Courses
			</h2>
			<div class="flex-1 overflow-y-auto">
				{#each data.courses as course (course.id)}
					<div class="group flex items-stretch">
						<div class="min-w-0 flex-1">
							<RenameableRow
								name={course.name}
								selected={course.id === data.course?.id}
								href={`?course=${course.id}`}
								action="?/renameCourse"
								hidden={{ id: course.id }}
							/>
						</div>
						<span class="flex shrink-0 items-center pr-2 opacity-0 group-hover:opacity-100">
							<form
								method="POST"
								action="?/deleteCourse"
								use:enhance={() => {
									return async ({ result, update }) => {
										if (result.type === 'failure' && result.data?.needsConfirm) {
											pendingDelete = { kind: 'course', id: course.id, name: course.name };
											return;
										}
										await update();
									};
								}}
							>
								<input type="hidden" name="id" value={course.id} />
								<Button
									type="submit"
									variant="ghost"
									size="icon-sm"
									class="hover:text-destructive"
									aria-label="Delete {course.name}"
								>
									<XIcon class="size-3.5" />
								</Button>
							</form>
						</span>
					</div>
				{/each}
				{#if !data.courses.length}
					<p class="px-4 text-sm text-muted-foreground">No Courses yet.</p>
				{/if}
			</div>
			<form
				method="POST"
				action="?/createCourse"
				class="px-4 pt-2"
				use:enhance={createThenSelect(
					'course',
					(id) => `?course=${id}`,
					() => courseNameInput?.focus()
				)}
			>
				<Input
					bind:ref={courseNameInput}
					name="name"
					required
					autocomplete="off"
					class="h-7 w-full"
					placeholder="New Course name — press Enter"
				/>
			</form>
		</aside>

		<!-- pane 2: Topics -->
		<aside class="flex w-64 shrink-0 flex-col border-r py-3">
			<h2 class="px-4 pb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
				Topics
			</h2>
			{#if !data.course}
				<p class="px-4 text-sm text-muted-foreground">Pick a Course.</p>
			{:else}
				<div class="flex-1 overflow-y-auto">
					{#each data.topics as topic (topic.id)}
						<div class="group flex items-stretch">
							<div class="min-w-0 flex-1">
								<RenameableRow
									name={topic.name}
									selected={topic.id === data.topic?.id}
									href={`?course=${data.course.id}&topic=${topic.id}`}
									action="?/renameTopic"
									hidden={{ id: topic.id }}
								/>
							</div>
							<span class="flex shrink-0 items-center pr-2 opacity-0 group-hover:opacity-100">
								<form
									method="POST"
									action="?/deleteTopic"
									use:enhance={() => {
										return async ({ result, update }) => {
											if (result.type === 'failure' && result.data?.needsConfirm) {
												pendingDelete = { kind: 'topic', id: topic.id, name: topic.name };
												return;
											}
											await update();
										};
									}}
								>
									<input type="hidden" name="id" value={topic.id} />
									<Button
										type="submit"
										variant="ghost"
										size="icon-sm"
										class="hover:text-destructive"
										aria-label="Delete {topic.name}"
									>
										<XIcon class="size-3.5" />
									</Button>
								</form>
							</span>
						</div>
					{/each}
					{#if !data.topics.length}
						<p class="px-4 text-sm text-muted-foreground">No Topics yet.</p>
					{/if}
				</div>
				<form
					method="POST"
					action="?/createTopic"
					class="px-4 pt-2"
					use:enhance={createThenSelect(
						'topic',
						(id) => `?course=${data.course?.id}&topic=${id}`,
						() => topicNameInput?.focus()
					)}
				>
					<input type="hidden" name="courseId" value={data.course.id} />
					<Input
						bind:ref={topicNameInput}
						name="name"
						required
						autocomplete="off"
						class="h-7 w-full"
						placeholder="New Topic name — press Enter"
					/>
				</form>
			{/if}
		</aside>

		<!-- pane 3: Lessons -->
		<main class="flex min-w-0 flex-1 flex-col">
			{#if !data.topic}
				<div class="p-10 text-sm text-muted-foreground">Pick a Topic.</div>
			{:else}
				<div class="border-b px-6 py-4">
					<h2 class="text-base font-semibold">{data.topic.name}</h2>
					<p class="mt-1 text-xs text-muted-foreground">
						{data.lessons.length} Lesson{data.lessons.length === 1 ? '' : 's'}
					</p>
					<p class="mt-1 text-[11px] text-muted-foreground">
						Editing these Lessons moves dates for every Class already teaching this Topic.
					</p>
				</div>

				<ol class="flex-1 divide-y overflow-y-auto">
					{#each data.lessons as lesson, i (lesson.id)}
						<li class="group flex items-baseline gap-3 pl-2">
							<span class="w-6 shrink-0 pl-4 font-mono text-xs text-muted-foreground/60">
								{i + 1}
							</span>
							<div class="min-w-0 flex-1">
								<RenameableRow
									name={lesson.title}
									selected={lesson.id === data.lesson?.id}
									href={`?course=${data.course?.id}&topic=${data.topic.id}&lesson=${lesson.id}`}
									action="?/renameLesson"
									hidden={{ id: lesson.id }}
									field="title"
								/>
							</div>
							<span
								class="flex shrink-0 items-center gap-0.5 pr-2 opacity-0 group-hover:opacity-100"
							>
								<ReorderButtons
									action="?/moveLesson"
									fields={{ topicId: data.topic.id, id: lesson.id }}
									label={lesson.title}
									first={i === 0}
									last={i === data.lessons.length - 1}
								/>
								<form method="POST" action="?/deleteLesson" use:enhance>
									<input type="hidden" name="id" value={lesson.id} />
									<Button
										type="submit"
										variant="ghost"
										size="icon-sm"
										class="hover:text-destructive"
										aria-label="Delete {lesson.title}"
									>
										<XIcon class="size-3.5" />
									</Button>
								</form>
							</span>
						</li>
					{/each}
					{#if !data.lessons.length}
						<li class="px-6 py-4 text-sm text-muted-foreground">No Lessons yet.</li>
					{/if}
				</ol>

				<form
					method="POST"
					action="?/createLesson"
					class="border-t px-6 py-3"
					use:enhance={() => {
						return async ({ update }) => {
							await update();
							lessonTitleInput?.focus();
						};
					}}
				>
					<input type="hidden" name="topicId" value={data.topic.id} />
					<Input
						bind:ref={lessonTitleInput}
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
		</main>
	</div>
</div>

{#if data.lesson && data.course && data.topic}
	{@const courseId = data.course.id}
	<LessonEditor
		lesson={data.lesson}
		links={data.links}
		index={data.lessonIndex}
		count={data.lessons.length}
		previousId={data.lessonIndex > 0 ? data.lessons[data.lessonIndex - 1].id : null}
		nextId={data.lessonIndex < data.lessons.length - 1
			? data.lessons[data.lessonIndex + 1].id
			: null}
		topicId={data.topic.id}
		topics={data.topics}
		taughtBy={data.taughtBy}
		hrefFor={(lessonId, topicId) =>
			`?course=${courseId}&topic=${topicId}${lessonId ? `&lesson=${lessonId}` : ''}`}
	/>
{/if}

<ConfirmDeleteDialog
	bind:target={pendingDelete}
	action={pendingDelete?.kind === 'topic' ? '?/deleteTopic' : '?/deleteCourse'}
	description={pendingDelete?.kind === 'topic'
		? 'This Topic still holds Lessons. Deleting it removes them too.'
		: 'This Course still holds Topics. Deleting it removes them too.'}
/>
