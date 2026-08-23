<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import LessonEditor from './LessonEditor.svelte';
	import RenameableRow from './RenameableRow.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Courses</title></svelte:head>

<div class="flex min-h-0 flex-1">
	<!-- pane 1: Courses -->
	<aside class="flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-white py-3">
		<h2 class="px-4 pb-2 text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
			Courses
		</h2>
		<div class="flex-1 overflow-y-auto">
			{#each data.courses as course (course.id)}
				<RenameableRow
					name={course.name}
					selected={course.id === data.course?.id}
					href={`?course=${course.id}`}
					action="?/renameCourse"
					hidden={{ id: course.id }}
				/>
			{/each}
		</div>
		<form
			method="POST"
			action="?/createCourse"
			class="px-4 pt-2"
			use:enhance={() => {
				return async ({ formElement, result }) => {
					const course =
						result.type === 'success' && (result.data as { course?: { id: string } })?.course;
					if (course) {
						formElement.reset();
						// eslint-disable-next-line svelte/no-navigation-without-resolve -- carries a query string
						await goto(`?course=${course.id}`, {
							replaceState: true,
							noScroll: true,
							keepFocus: true,
							invalidateAll: true
						});
					} else {
						await applyAction(result);
					}
				};
			}}
		>
			<input
				name="name"
				required
				autocomplete="off"
				class="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-neutral-900 focus:outline-none"
				placeholder="New Course name — press Enter"
			/>
		</form>
	</aside>

	<!-- pane 2: Topics -->
	<aside class="flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-white py-3">
		<h2 class="px-4 pb-2 text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
			Topics
		</h2>
		{#if !data.course}
			<p class="px-4 text-sm text-neutral-400">Pick a Course.</p>
		{:else}
			<div class="flex-1 overflow-y-auto">
				{#each data.topics as topic (topic.id)}
					<RenameableRow
						name={topic.name}
						selected={topic.id === data.topic?.id}
						href={`?course=${data.course.id}&topic=${topic.id}`}
						action="?/renameTopic"
						hidden={{ id: topic.id }}
					/>
				{/each}
			</div>
			<form
				method="POST"
				action="?/createTopic"
				class="px-4 pt-2"
				use:enhance={() => {
					return async ({ formElement, result }) => {
						const topic =
							result.type === 'success' && (result.data as { topic?: { id: string } })?.topic;
						if (topic && data.course) {
							formElement.reset();
							// eslint-disable-next-line svelte/no-navigation-without-resolve -- carries a query string
							await goto(`?course=${data.course.id}&topic=${topic.id}`, {
								replaceState: true,
								noScroll: true,
								keepFocus: true,
								invalidateAll: true
							});
						} else {
							await applyAction(result);
						}
					};
				}}
			>
				<input type="hidden" name="courseId" value={data.course.id} />
				<input
					name="name"
					required
					autocomplete="off"
					class="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-neutral-900 focus:outline-none"
					placeholder="New Topic name — press Enter"
				/>
			</form>
		{/if}
	</aside>

	<!-- pane 3: Lessons -->
	<main class="flex min-w-0 flex-1 flex-col">
		{#if !data.topic}
			<div class="p-10 text-sm text-neutral-400">Pick a Topic.</div>
		{:else}
			<div class="border-b border-neutral-200 bg-white px-6 py-4">
				<h2 class="text-base font-semibold">{data.topic.name}</h2>
				<p class="mt-1 text-xs text-neutral-500">
					{data.lessons.length} Lesson{data.lessons.length === 1 ? '' : 's'}
				</p>
				<p class="mt-1 text-[11px] text-neutral-400">
					Editing these Lessons moves dates for every Class already teaching this Topic.
				</p>
				{#if form?.error}
					<p role="alert" class="mt-1 text-xs text-neutral-500">{form.error}</p>
				{/if}
			</div>

			<ol class="flex-1 divide-y divide-neutral-100 overflow-y-auto bg-white">
				{#each data.lessons as lesson, i (lesson.id)}
					<li class="group flex items-baseline gap-3 pl-2">
						<span class="w-6 shrink-0 pl-4 font-mono text-xs text-neutral-300">{i + 1}</span>
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
						<span class="flex shrink-0 items-center gap-0.5 pr-2 opacity-0 group-hover:opacity-100">
							<form method="POST" action="?/moveLesson" use:enhance>
								<input type="hidden" name="topicId" value={data.topic.id} />
								<input type="hidden" name="id" value={lesson.id} />
								<input type="hidden" name="direction" value="up" />
								<button
									type="submit"
									class="px-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-25"
									disabled={i === 0}
									aria-label="Move {lesson.title} up"
								>
									↑
								</button>
							</form>
							<form method="POST" action="?/moveLesson" use:enhance>
								<input type="hidden" name="topicId" value={data.topic.id} />
								<input type="hidden" name="id" value={lesson.id} />
								<input type="hidden" name="direction" value="down" />
								<button
									type="submit"
									class="px-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-25"
									disabled={i === data.lessons.length - 1}
									aria-label="Move {lesson.title} down"
								>
									↓
								</button>
							</form>
							<form method="POST" action="?/deleteLesson" use:enhance>
								<input type="hidden" name="id" value={lesson.id} />
								<button
									type="submit"
									class="px-1 text-neutral-400 hover:text-red-600"
									aria-label="Delete {lesson.title}"
								>
									✕
								</button>
							</form>
						</span>
					</li>
				{/each}
			</ol>

			<form
				method="POST"
				action="?/createLesson"
				use:enhance
				class="border-t border-neutral-200 bg-white px-6 py-3"
			>
				<input type="hidden" name="topicId" value={data.topic.id} />
				<input
					name="title"
					required
					autocomplete="off"
					class="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
					placeholder="New Lesson title — press Enter"
				/>
				<p class="mt-1.5 text-[11px] text-neutral-400">
					Title alone is a complete Lesson. Add notes and links whenever.
				</p>
			</form>
		{/if}
	</main>
</div>

{#if data.lesson && data.course && data.topic}
	<LessonEditor
		lesson={data.lesson}
		links={data.links}
		index={data.lessonIndex}
		count={data.lessons.length}
		previousId={data.lessonIndex > 0 ? data.lessons[data.lessonIndex - 1].id : null}
		nextId={data.lessonIndex < data.lessons.length - 1
			? data.lessons[data.lessonIndex + 1].id
			: null}
		courseId={data.course.id}
		topicId={data.topic.id}
		topics={data.topics}
		taughtBy={data.taughtBy}
	/>
{/if}
