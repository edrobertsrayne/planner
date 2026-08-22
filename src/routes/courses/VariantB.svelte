<!--
	PROTOTYPE — throwaway. Variant B — "Its own space". Opening a Lesson replaces the whole screen
	rather than overlaying it — no dialog, no backdrop. A breadcrumb takes you back to the Topic;
	prev/next are page-level controls, not modal chrome. Tests the ticket's suggestion that a Lesson
	editor with notes, links and previous/next navigation "may deserve its own route rather than a
	modal" — same URL params as today, but the render swaps entirely instead of layering.
-->
<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import LinkRow from './LinkRow.svelte';
	import RenameableRow from './RenameableRow.svelte';
	import type { CoursesPageData } from './types';

	let { data, form }: { data: CoursesPageData; form: { error?: string } | null } = $props();

	function browseHref(overrides: { course?: string; topic?: string } = {}) {
		const course = overrides.course ?? data.course?.id;
		const topic = overrides.topic ?? data.topic?.id;
		let href = `?variant=B`;
		if (course) href += `&course=${course}`;
		if (topic) href += `&topic=${topic}`;
		return href;
	}

	function lessonHref(lessonId: string) {
		return `${browseHref()}&lesson=${lessonId}`;
	}

	async function step(lessonId: string | null) {
		if (!lessonId) return;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- prototype-only param
		await goto(lessonHref(lessonId), { replaceState: true, noScroll: true, keepFocus: true });
	}

	let addingLink = $state(false);

	function onkeydown(e: KeyboardEvent) {
		if (!data.lesson) return;
		const el = document.activeElement as HTMLElement | null;
		const typing =
			el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
		if (typing) return;
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			step(previousId);
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			step(nextId);
		}
	}

	const previousId = $derived(data.lessonIndex > 0 ? data.lessons[data.lessonIndex - 1].id : null);
	const nextId = $derived(
		data.lessonIndex < data.lessons.length - 1 ? data.lessons[data.lessonIndex + 1].id : null
	);
</script>

<svelte:window {onkeydown} />

{#if data.lesson && data.course && data.topic}
	{@const lesson = data.lesson}
	{@const course = data.course}
	{@const topic = data.topic}
	<div class="flex min-h-0 flex-1 flex-col">
		<div class="flex items-center gap-3 border-b px-6 py-3">
			<Button
				variant="ghost"
				size="sm"
				href={browseHref()}
				class="h-7 gap-1 text-xs text-muted-foreground"
			>
				<ChevronLeftIcon class="size-3.5" />
				{course.name} / {topic.name}
			</Button>
			<span class="ml-auto text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
				Lesson {data.lessonIndex + 1} of {data.lessons.length}
			</span>
			<span class="flex items-center gap-0.5">
				<Button
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
		</div>

		<div
			class="mx-auto grid min-h-0 w-full max-w-4xl flex-1 grid-cols-[minmax(0,1fr)_18rem] gap-8 overflow-y-auto px-6 py-8"
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
						class="h-auto border-0 bg-transparent px-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0"
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
						class="mt-1.5 min-h-96 flex-1 resize-none font-mono text-xs leading-relaxed"
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
									const href = `${browseHref({ topic: newTopicId })}&lesson=${lesson.id}`;
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
	</div>
{:else}
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
						href={browseHref({ course: course.id, topic: '' })}
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
							await goto(browseHref({ course: course.id, topic: '' }), {
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

		<main class="flex min-w-0 flex-1 flex-col">
			{#if !data.course}
				<div class="p-10 text-sm text-muted-foreground">Pick a Course.</div>
			{:else}
				<div class="border-b px-6 py-4">
					<h2 class="text-base font-semibold">{data.course.name}</h2>
				</div>
				<ul class="flex-1 divide-y overflow-y-auto">
					{#each data.topics as topicItem (topicItem.id)}
						<li>
							<div class="flex items-center justify-between px-2">
								<div class="min-w-0 flex-1">
									<RenameableRow
										name={topicItem.name}
										selected={false}
										action="?/renameTopic"
										hidden={{ id: topicItem.id }}
									/>
								</div>
								<Button
									variant="ghost"
									size="sm"
									href={`${browseHref({ topic: topicItem.id })}`}
									class="mr-2 h-7 shrink-0 gap-1 text-xs text-muted-foreground"
								>
									Open<ChevronRightIcon class="size-3.5" />
								</Button>
							</div>
						</li>
					{/each}
				</ul>
				<form
					method="POST"
					action="?/createTopic"
					class="border-t px-6 py-3"
					use:enhance={() => {
						return async ({ formElement, result }) => {
							const topicResult =
								result.type === 'success' && (result.data as { topic?: { id: string } })?.topic;
							if (topicResult && data.course) {
								formElement.reset();
								const href = browseHref({ topic: topicResult.id });
								// eslint-disable-next-line svelte/no-navigation-without-resolve -- prototype-only param
								await goto(href, {
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
		</main>

		{#if data.topic}
			<aside class="flex w-72 shrink-0 flex-col border-l py-3">
				<h2 class="px-4 pb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
					{data.topic.name}
				</h2>
				<ol class="flex-1 divide-y overflow-y-auto">
					<!-- eslint-disable svelte/no-navigation-without-resolve -- href carries a query string -->
					{#each data.lessons as lesson, i (lesson.id)}
						<li>
							<a
								href={lessonHref(lesson.id)}
								class="flex items-baseline gap-2 px-4 py-2 text-sm hover:bg-accent"
							>
								<span class="w-4 shrink-0 font-mono text-xs text-muted-foreground/60">{i + 1}</span>
								<span class="min-w-0 flex-1 truncate">{lesson.title}</span>
							</a>
						</li>
					{/each}
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</ol>
				<form method="POST" action="?/createLesson" use:enhance class="px-4 pt-2">
					<input type="hidden" name="topicId" value={data.topic.id} />
					<Input
						name="title"
						required
						autocomplete="off"
						class="h-7 w-full"
						placeholder="New Lesson title — press Enter"
					/>
				</form>
			</aside>
		{/if}
	</div>
{/if}

{#if form?.error}
	<p role="alert" class="fixed bottom-16 left-1/2 -translate-x-1/2 text-xs text-destructive">
		{form.error}
	</p>
{/if}
