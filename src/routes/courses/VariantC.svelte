<!--
	PROTOTYPE — throwaway. Variant C — "Inline, no modal". Course and Topic collapse into one
	nested-disclosure rail (two panes instead of three); each Lesson expands in place in the main
	list instead of opening anything. Several Lessons can be open at once — the direct answer to
	"does the design support writing a Topic's worth of Lessons in a row, or fight it one dialog at
	a time". Lesson title is always a live field once expanded, not a click-to-edit label — the
	inline-rename idiom is tested here against a plain always-editable input.
-->
<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import XIcon from '@lucide/svelte/icons/x';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import LinkRow from './LinkRow.svelte';
	import RenameableRow from './RenameableRow.svelte';
	import type { CoursesPageData } from './types';

	let { data, form }: { data: CoursesPageData; form: { error?: string } | null } = $props();

	function topicHref(courseId: string, topicId: string) {
		return `?variant=C&course=${courseId}&topic=${topicId}`;
	}

	// Which Lessons are expanded — several at once, so writing a run of Lessons doesn't mean
	// closing one to open the next.
	let openLessons = $state<string[]>([]);

	$effect(() => {
		if (data.lesson && !openLessons.includes(data.lesson.id)) {
			openLessons = [...openLessons, data.lesson.id];
		}
	});
</script>

<div class="flex min-h-0 flex-1">
	<aside class="flex w-72 shrink-0 flex-col overflow-y-auto border-r py-2">
		<Accordion.Root type="multiple" value={data.course ? [data.course.id] : []} class="w-full">
			{#each data.courses as course (course.id)}
				<Accordion.Item value={course.id} class="border-b-0 data-open:bg-transparent">
					<Accordion.Trigger class="px-3 py-2 text-sm font-medium">
						{course.name}
					</Accordion.Trigger>
					<Accordion.Content class="pb-1">
						<!-- eslint-disable svelte/no-navigation-without-resolve -- href carries a query string -->
						<ul class="pl-3">
							{#each data.topics.filter(() => data.course?.id === course.id) as topic (topic.id)}
								<li>
									<a
										href={topicHref(course.id, topic.id)}
										class="flex items-center px-3 py-1.5 text-sm hover:bg-accent {topic.id ===
										data.topic?.id
											? 'bg-accent font-medium'
											: 'text-muted-foreground'}"
									>
										{topic.name}
									</a>
								</li>
							{/each}
							{#if data.course?.id === course.id}
								<li class="px-3 pt-1">
									<form
										method="POST"
										action="?/createTopic"
										use:enhance={() => {
											return async ({ formElement, result }) => {
												const topicResult =
													result.type === 'success' &&
													(result.data as { topic?: { id: string } })?.topic;
												if (topicResult && data.course) {
													formElement.reset();
													const href = topicHref(data.course.id, topicResult.id);
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
										<input type="hidden" name="courseId" value={course.id} />
										<Input
											name="name"
											required
											autocomplete="off"
											class="h-6 text-xs"
											placeholder="+ New Topic"
										/>
									</form>
								</li>
							{/if}
						</ul>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</Accordion.Content>
				</Accordion.Item>
			{/each}
		</Accordion.Root>

		<form
			method="POST"
			action="?/createCourse"
			class="px-3 pt-3"
			use:enhance={() => {
				return async ({ formElement, result }) => {
					const course =
						result.type === 'success' && (result.data as { course?: { id: string } })?.course;
					if (course) {
						formElement.reset();
						// eslint-disable-next-line svelte/no-navigation-without-resolve -- prototype-only param
						await goto(`?variant=C&course=${course.id}`, {
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

	<main class="flex min-w-0 flex-1 flex-col overflow-y-auto">
		{#if !data.topic}
			<div class="p-10 text-sm text-muted-foreground">Pick a Topic.</div>
		{:else}
			{@const topic = data.topic}
			<div class="sticky top-0 z-10 border-b bg-background px-6 py-4">
				<RenameableRow name={topic.name} action="?/renameTopic" hidden={{ id: topic.id }} />
				<p class="mt-1 px-4 text-xs text-muted-foreground">
					{data.lessons.length} Lesson{data.lessons.length === 1 ? '' : 's'} — editing them moves dates
					for every Class already teaching this Topic.
				</p>
				{#if form?.error}
					<p role="alert" class="mt-1 px-4 text-xs text-destructive">{form.error}</p>
				{/if}
			</div>

			<form
				method="POST"
				action="?/createLesson"
				use:enhance
				class="border-b bg-muted/30 px-6 py-3"
			>
				<input type="hidden" name="topicId" value={topic.id} />
				<Input
					name="title"
					required
					autocomplete="off"
					class="h-8 w-full bg-background"
					placeholder="New Lesson title — press Enter, then expand to add notes"
				/>
			</form>

			<Accordion.Root type="multiple" bind:value={openLessons} class="flex-1">
				{#each data.lessons as lesson, i (lesson.id)}
					<Accordion.Item value={lesson.id}>
						<div class="flex items-center pr-2">
							<Accordion.Trigger class="flex-1 gap-3 py-2.5 pl-2 font-normal">
								<span class="w-6 shrink-0 font-mono text-xs text-muted-foreground/60">{i + 1}</span>
								<span class="min-w-0 flex-1 truncate text-sm">{lesson.title}</span>
								{#if lesson.body}
									<Badge variant="outline" class="mr-2 text-[10px]">notes</Badge>
								{/if}
							</Accordion.Trigger>
							<span class="flex shrink-0 items-center gap-0.5">
								<form method="POST" action="?/moveLesson" use:enhance>
									<input type="hidden" name="topicId" value={topic.id} />
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
									<input type="hidden" name="topicId" value={topic.id} />
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
						</div>

						<Accordion.Content>
							<div class="grid grid-cols-[minmax(0,1fr)_16rem] gap-4 px-4 pb-4 pl-11">
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
									<div class="min-w-0">
										<Input
											name="title"
											value={lesson.title}
											required
											autocomplete="off"
											class="h-7"
											onblur={(e) => e.currentTarget.form?.requestSubmit()}
										/>
										<Textarea
											name="body"
											value={lesson.body ?? ''}
											class="mt-2 min-h-32 resize-none font-mono text-xs leading-relaxed"
											placeholder="Notes, objectives, what to set up…"
											onblur={(e) => e.currentTarget.form?.requestSubmit()}
										/>
										<label class="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
											Planned Length
											<Input
												type="number"
												name="plannedLength"
												min="1"
												value={lesson.plannedLength}
												class="h-6 w-14"
												onchange={(e) => e.currentTarget.form?.requestSubmit()}
											/>
											Periods
										</label>
									</div>
								</form>

								<div class="min-w-0">
									<span
										class="text-[11px] font-bold tracking-wider text-muted-foreground uppercase"
									>
										Links
									</span>
									<ul class="mt-1 space-y-1">
										{#if lesson.id === data.lesson?.id}
											{#each data.links as link, li (link.id)}
												<li class="rounded-md bg-muted px-2 py-1.5 text-sm">
													<LinkRow
														{link}
														lessonId={lesson.id}
														first={li === 0}
														last={li === data.links.length - 1}
													/>
												</li>
											{/each}
											{#if !data.links.length}
												<li class="px-1 py-1 text-xs text-muted-foreground">No Links yet.</li>
											{/if}
										{:else}
											<li class="px-1 py-1 text-xs text-muted-foreground">
												<!-- eslint-disable svelte/no-navigation-without-resolve -- prototype-only param -->
												<a
													href={`?variant=C&course=${data.course?.id}&topic=${topic.id}&lesson=${lesson.id}`}
													class="hover:underline"
												>
													Load Links…
												</a>
												<!-- eslint-enable svelte/no-navigation-without-resolve -->
											</li>
										{/if}
									</ul>
								</div>
							</div>
						</Accordion.Content>
					</Accordion.Item>
				{/each}
			</Accordion.Root>
		{/if}
	</main>
</div>
