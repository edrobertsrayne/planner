<!--
	PROTOTYPE — throwaway. Variant A — "Dialog, fixed". The smallest structural change: keep the
	three-pane Course/Topic/Lesson browser exactly as it is today, but replace the hand-rolled
	`role="dialog"` (no focus trap, no Escape handling) with a real shadcn Dialog. Tests whether the
	existing shape survives a straight restyle, or whether the Lesson editor visibly wants more room
	than a dialog can give it.
-->
<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import LinkRow from './LinkRow.svelte';
	import RenameableRow from './RenameableRow.svelte';
	import type { CoursesPageData } from './types';

	let { data, form }: { data: CoursesPageData; form: { error?: string } | null } = $props();

	function hrefFor(lessonId: string | null) {
		const base = `?variant=A&course=${data.course?.id}&topic=${data.topic?.id}`;
		return lessonId ? `${base}&lesson=${lessonId}` : base;
	}

	async function step(lessonId: string | null) {
		if (!lessonId) return;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- prototype-only param
		await goto(hrefFor(lessonId), { replaceState: true, noScroll: true, keepFocus: true });
	}

	function onOpenChange(open: boolean) {
		if (open) return;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- prototype-only param
		goto(hrefFor(null), { replaceState: true, noScroll: true, keepFocus: true });
	}

	let addingLink = $state(false);
</script>

<div class="flex min-h-0 flex-1">
	<aside class="flex w-64 shrink-0 flex-col border-r py-3">
		<h2 class="px-4 pb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
			Courses
		</h2>
		<div class="flex-1 overflow-y-auto">
			{#each data.courses as course (course.id)}
				<RenameableRow
					name={course.name}
					selected={course.id === data.course?.id}
					href={`?variant=A&course=${course.id}`}
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
						// eslint-disable-next-line svelte/no-navigation-without-resolve -- prototype-only param
						await goto(`?variant=A&course=${course.id}`, {
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
			<Input
				name="name"
				required
				autocomplete="off"
				class="h-7 w-full"
				placeholder="New Course name — press Enter"
			/>
		</form>
	</aside>

	<aside class="flex w-64 shrink-0 flex-col border-r py-3">
		<h2 class="px-4 pb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
			Topics
		</h2>
		{#if !data.course}
			<p class="px-4 text-sm text-muted-foreground">Pick a Course.</p>
		{:else}
			<div class="flex-1 overflow-y-auto">
				{#each data.topics as topic (topic.id)}
					<RenameableRow
						name={topic.name}
						selected={topic.id === data.topic?.id}
						href={`?variant=A&course=${data.course.id}&topic=${topic.id}`}
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
							// eslint-disable-next-line svelte/no-navigation-without-resolve -- prototype-only param
							await goto(`?variant=A&course=${data.course.id}&topic=${topic.id}`, {
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
				<Input
					name="name"
					required
					autocomplete="off"
					class="h-7 w-full"
					placeholder="New Topic name — press Enter"
				/>
			</form>
		{/if}
	</aside>

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
				{#if form?.error}
					<p role="alert" class="mt-1 text-xs text-destructive">{form.error}</p>
				{/if}
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
								href={`?variant=A&course=${data.course?.id}&topic=${data.topic.id}&lesson=${lesson.id}`}
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
								<Button
									type="submit"
									variant="ghost"
									size="icon"
									class="size-6"
									disabled={i === 0}
									aria-label="Move {lesson.title} up"
								>
									<ChevronUpIcon class="size-3.5" />
								</Button>
							</form>
							<form method="POST" action="?/moveLesson" use:enhance>
								<input type="hidden" name="topicId" value={data.topic.id} />
								<input type="hidden" name="id" value={lesson.id} />
								<input type="hidden" name="direction" value="down" />
								<Button
									type="submit"
									variant="ghost"
									size="icon"
									class="size-6"
									disabled={i === data.lessons.length - 1}
									aria-label="Move {lesson.title} down"
								>
									<ChevronDownIcon class="size-3.5" />
								</Button>
							</form>
							<form method="POST" action="?/deleteLesson" use:enhance>
								<input type="hidden" name="id" value={lesson.id} />
								<Button
									type="submit"
									variant="ghost"
									size="icon"
									class="size-6 hover:text-destructive"
									aria-label="Delete {lesson.title}"
								>
									<XIcon class="size-3.5" />
								</Button>
							</form>
						</span>
					</li>
				{/each}
			</ol>

			<form method="POST" action="?/createLesson" use:enhance class="border-t px-6 py-3">
				<input type="hidden" name="topicId" value={data.topic.id} />
				<Input
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

{#if data.lesson && data.course && data.topic}
	{@const lesson = data.lesson}
	{@const course = data.course}
	{@const topic = data.topic}
	{@const previousId = data.lessonIndex > 0 ? data.lessons[data.lessonIndex - 1].id : null}
	{@const nextId =
		data.lessonIndex < data.lessons.length - 1 ? data.lessons[data.lessonIndex + 1].id : null}
	<Dialog.Root open={true} {onOpenChange}>
		<Dialog.Content
			class="flex max-h-[85vh] w-full max-w-4xl flex-col gap-0 p-0 sm:max-w-4xl"
			showCloseButton
		>
			<Dialog.Header
				class="flex-row items-center gap-3 space-y-0 border-b px-6 py-3 [&>button]:static"
			>
				<span class="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
					Lesson {data.lessonIndex + 1} of {data.lessons.length}
				</span>
				<Dialog.Title class="sr-only">{lesson.title}</Dialog.Title>
				<span class="ml-auto flex items-center gap-0.5">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						class="size-7"
						disabled={!previousId}
						onclick={() => step(previousId)}
						aria-label="Previous Lesson"
					>
						<ChevronUpIcon class="size-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						class="size-7"
						disabled={!nextId}
						onclick={() => step(nextId)}
						aria-label="Next Lesson"
					>
						<ChevronDownIcon class="size-4" />
					</Button>
				</span>
			</Dialog.Header>

			<div
				class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_18rem] gap-6 overflow-y-auto px-6 py-6"
			>
				<form
					method="POST"
					action="?/updateLesson"
					class="contents"
					use:enhance={() => {
						return async ({ update }) => {
							await update({ reset: false });
						};
					}}
				>
					<input type="hidden" name="id" value={lesson.id} />
					<div class="col-span-2">
						<Input
							name="title"
							value={lesson.title}
							required
							autocomplete="off"
							class="h-auto border-0 bg-transparent px-0 text-xl font-semibold tracking-tight shadow-none focus-visible:ring-0"
							placeholder="Lesson title…"
							onblur={(e) => e.currentTarget.form?.requestSubmit()}
						/>
					</div>

					<label class="row-span-2 flex min-h-0 flex-col">
						<span class="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
							Notes & objectives
						</span>
						<Textarea
							name="body"
							value={lesson.body ?? ''}
							class="mt-1.5 min-h-72 flex-1 resize-none font-mono text-xs leading-relaxed"
							placeholder="Markdown — objectives, what to set up, what went wrong last time…"
							onblur={(e) => e.currentTarget.form?.requestSubmit()}
						/>
					</label>

					<label class="block">
						<span class="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
							Planned Length
						</span>
						<div class="mt-1 flex items-center gap-2">
							<Input
								type="number"
								name="plannedLength"
								min="1"
								value={lesson.plannedLength}
								class="h-7 w-16"
								onchange={(e) => e.currentTarget.form?.requestSubmit()}
							/>
							<span class="text-sm text-muted-foreground">Periods</span>
						</div>
					</label>
				</form>

				<div>
					<label class="block">
						<span class="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
							Topic
						</span>
						<form
							method="POST"
							action="?/moveLessonToTopic"
							class="mt-1"
							use:enhance={() => {
								return async ({ formData, result, update }) => {
									if (result.type === 'success') {
										const newTopicId = String(formData.get('topicId'));
										const href = `?variant=A&course=${course.id}&topic=${newTopicId}&lesson=${lesson.id}`;
										// eslint-disable-next-line svelte/no-navigation-without-resolve -- prototype-only param
										await goto(href, {
											replaceState: true,
											noScroll: true,
											keepFocus: true,
											invalidateAll: true
										});
									} else {
										await update();
									}
								};
							}}
						>
							<input type="hidden" name="id" value={lesson.id} />
							<Select.Root
								type="single"
								value={topic.id}
								onValueChange={(v) => {
									if (!v) return;
									const el = document.querySelector<HTMLFormElement>(
										'form[action="?/moveLessonToTopic"]'
									);
									const input = el?.querySelector<HTMLInputElement>('input[name=topicId]');
									if (input) input.value = v;
									el?.requestSubmit();
								}}
							>
								<Select.Trigger size="sm" class="w-full">
									{data.topics.find((t) => t.id === topic.id)?.name}
								</Select.Trigger>
								<Select.Content>
									{#each data.topics as t (t.id)}
										<Select.Item value={t.id} label={t.name} />
									{/each}
								</Select.Content>
							</Select.Root>
							<input type="hidden" name="topicId" value={topic.id} />
						</form>
					</label>

					{#if data.taughtBy.length}
						<p class="mt-2 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
							Taught by
							{#each data.taughtBy as c (c.id)}
								<Badge variant="outline">{c.label}</Badge>
							{/each}
						</p>
					{/if}
				</div>

				<div class="min-h-0 overflow-y-auto">
					<span class="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
						Links
					</span>
					<ul class="mt-1 space-y-1">
						{#each data.links as link, i (link.id)}
							<li class="rounded-md bg-muted px-2 py-1.5 text-sm">
								<LinkRow
									{link}
									lessonId={lesson.id}
									first={i === 0}
									last={i === data.links.length - 1}
								/>
							</li>
						{/each}
						{#if !data.links.length}
							<li class="px-1 py-1 text-xs text-muted-foreground">No Links yet.</li>
						{/if}
					</ul>

					{#if addingLink}
						<form
							method="POST"
							action="?/createLink"
							class="mt-2 space-y-1"
							use:enhance={() => {
								return async ({ result, update }) => {
									await update();
									if (result.type === 'success') addingLink = false;
								};
							}}
						>
							<input type="hidden" name="lessonId" value={lesson.id} />
							<Input
								autofocus
								name="label"
								required
								autocomplete="off"
								class="h-7 text-xs"
								placeholder="Label"
							/>
							<div class="flex gap-1">
								<Input
									name="url"
									type="url"
									required
									autocomplete="off"
									class="h-7 min-w-0 flex-1 text-xs"
									placeholder="https://…"
								/>
								<Button type="submit" size="sm" class="h-7 shrink-0 text-xs">Add</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									class="h-7 shrink-0 text-xs"
									onclick={() => (addingLink = false)}
								>
									Cancel
								</Button>
							</div>
						</form>
					{:else}
						<Button
							type="button"
							variant="ghost"
							size="sm"
							class="mt-2 h-7 text-xs"
							onclick={() => (addingLink = true)}
						>
							<PlusIcon class="size-3.5" />Add Link
						</Button>
					{/if}
				</div>
			</div>
		</Dialog.Content>
	</Dialog.Root>
{/if}
