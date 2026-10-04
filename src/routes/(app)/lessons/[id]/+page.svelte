<script lang="ts">
	import { enhance } from '$app/forms';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { courseHref, useBack } from '$lib/client/back';
	import { failureReason, onFail } from '$lib/client/enhance';
	import { toast } from 'svelte-sonner';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import MarkdownEditor from '$lib/components/markdown-editor.svelte';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import TagBadge from '$lib/components/tag-badge.svelte';
	import AttachmentRow from './AttachmentRow.svelte';
	import LinkRow from './LinkRow.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const lesson = $derived(data.lesson);

	const back = useBack(() =>
		data.course && data.topic ? courseHref(data.course.id, data.topic.id) : resolve('/courses')
	);

	// Title and plan save on blur. Blurring the focused field before every move off this page, Back,
	// the breadcrumb and the sidebar included, commits an edit Ed has not clicked away from yet.
	// The move then waits for that save: the next page loads its data when the move starts, and
	// would show the old title if the write were still in flight.
	let saving: Promise<void> | null = null;
	beforeNavigate(({ cancel, to, type, delta, willUnload }) => {
		(document.activeElement as HTMLElement | null)?.blur();
		if (!saving || !to || willUnload) return;
		cancel();
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the address the move was already heading to
		void saving.then(() => (type === 'popstate' ? history.go(delta) : goto(to.url)));
	});
	const saveLesson: SubmitFunction = () => {
		let saved: () => void;
		saving = new Promise((resolve) => (saved = resolve));
		return async ({ update }) => {
			try {
				// The fields save without unmounting, unlike a create-and-clear form — a reset here
				// would blank a field whose defaultValue was never set, since it's bound with
				// `value`, not `bind:value`.
				await update({ reset: false });
			} finally {
				saving = null;
				saved();
			}
		};
	};

	// Stepping follows the Topic's order and stops at both ends. It replaces the history entry, so
	// one browser Back leaves the Lesson editor however far Ed has stepped. It waits for a save
	// in flight (a click blurs the field first), since `beforeNavigate` would otherwise cancel the
	// move and redo it as a plain `goto` that pushes an entry.
	const index = $derived(data.siblingIds.indexOf(lesson.id));
	const previousId = $derived(index > 0 ? data.siblingIds[index - 1] : null);
	const nextId = $derived(
		index >= 0 && index < data.siblingIds.length - 1 ? data.siblingIds[index + 1] : null
	);
	async function step(id: string | null) {
		if (!id) return;
		await saving;
		await goto(resolve(`/lessons/${id}`), { replaceState: true });
	}
	function stepWithKey(e: KeyboardEvent) {
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		if (e.key !== '[' && e.key !== ']') return;
		const focused = document.activeElement as HTMLElement | null;
		if (focused?.matches('input, textarea, select, [contenteditable]')) return;
		e.preventDefault();
		void step(e.key === '[' ? previousId : nextId);
	}

	let statusInput: HTMLInputElement | null = $state(null);
	let addingLink = $state(false);
	let addingTag = $state(false);
	let fileInput: HTMLInputElement | null = $state(null);

	// Mirrors attachments.ts's MAX_BYTES (spec #219): a file over this never reaches the form
	// action, since a body over the server's own request-size cap (src/lib/server/body-limit.ts)
	// fails before the action runs, turning what should be this same readable refusal into a
	// SvelteKit error page instead.
	const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
</script>

<svelte:head><title>{lesson.title}</title></svelte:head>
<svelte:window onkeydown={stepWithKey} />

{#snippet heading(text: string)}
	<h2 class="mb-1.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
		{text}
	</h2>
{/snippet}

<div class="mx-auto max-w-6xl px-6 pt-4 pb-24">
	<div class="flex items-center gap-2">
		<Button variant="ghost" size="sm" class="-ml-3" onclick={back}>
			<ArrowLeftIcon data-icon="inline-start" />
			Back
		</Button>
		{#if data.course && data.topic}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- courseHref resolves it -->
			<a
				href={courseHref(data.course.id, data.topic.id)}
				class="flex min-w-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground pointer-coarse:min-h-11"
			>
				<span class="max-w-60 truncate">{data.course.name}</span>
				<ChevronRightIcon class="size-3 shrink-0" />
				<span class="max-w-80 truncate">{data.topic.name}</span>
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/if}
		{#if index >= 0}
			<div class="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="Previous Lesson"
					disabled={!previousId}
					onclick={() => step(previousId)}
				>
					<ChevronLeftIcon />
				</Button>
				<span class="tabular-nums">Lesson {index + 1} of {data.siblingIds.length}</span>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="Next Lesson"
					disabled={!nextId}
					onclick={() => step(nextId)}
				>
					<ChevronRightIcon />
				</Button>
			</div>
		{/if}
	</div>

	<!-- Stepping reuses this page, so everything seeded from the Lesson starts afresh per Lesson. -->
	{#key lesson.id}
		<!-- Below `lg` the columns and the rail dissolve (`contents`) into one stack, so `order` can
	     put the status card between the title and the plan, and the rest of the rail after it. -->
		<div class="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
			<div class="min-w-0 max-lg:contents">
				<!-- Title and plan save together as one Lesson write; Length joins them through its
			     `form` attribute. Links and the rest are their own forms and cannot nest in this one. -->
				<form
					id="lesson-form"
					method="POST"
					action="?/updateLesson"
					class="contents"
					use:enhance={saveLesson}
				>
					<input type="hidden" name="id" value={lesson.id} />
					<Input
						name="title"
						value={lesson.title}
						required
						autocomplete="off"
						aria-label="Lesson title"
						class="h-auto w-full border-0 bg-transparent px-0 py-1 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0 max-lg:order-1 md:text-2xl"
						placeholder="Lesson title…"
						onblur={(e) => e.currentTarget.form?.requestSubmit()}
					/>
					<div class="mt-4 max-lg:order-3 max-lg:mt-0 max-lg:min-w-0">
						<MarkdownEditor
							name="body"
							value={lesson.body ?? ''}
							label="Notes & objectives"
							placeholder="Objectives, what to set up, what went wrong last time…"
							toolbarClass="sticky top-[68px] z-[5] bg-muted md:top-3 before:absolute before:-inset-x-px before:-top-3 before:h-3 before:bg-background before:content-['']"
							bodyClass="min-h-[28rem] overflow-visible"
							onblur={() =>
								(document.getElementById('lesson-form') as HTMLFormElement).requestSubmit()}
						/>
					</div>
				</form>
			</div>

			<!-- The rail scrolls with the page on a laptop; below `lg` it dissolves into the stack. -->
			<aside class="min-w-0 space-y-5 max-lg:contents max-lg:space-y-0 lg:self-start">
				<div class="space-y-5 max-lg:contents max-lg:space-y-0">
					<div
						class="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 rounded-lg border p-3 text-sm max-lg:order-2"
					>
						<span class="text-muted-foreground">Status</span>
						<form method="POST" action="?/setLessonStatus" use:enhance>
							<input type="hidden" name="id" value={lesson.id} />
							<input type="hidden" name="status" value={lesson.status} bind:this={statusInput} />
							<ToggleGroup.Root
								type="single"
								variant="outline"
								size="sm"
								value={lesson.status}
								onValueChange={(v) => {
									if (v && v !== lesson.status && statusInput) {
										statusInput.value = v;
										statusInput.form?.requestSubmit();
									}
								}}
								class="justify-start"
							>
								<ToggleGroup.Item value="draft">Draft</ToggleGroup.Item>
								<ToggleGroup.Item value="planned">Planned</ToggleGroup.Item>
							</ToggleGroup.Root>
						</form>

						<label for="lesson-length" class="text-muted-foreground">Length</label>
						<div class="flex items-center gap-2">
							<Input
								id="lesson-length"
								form="lesson-form"
								type="number"
								name="length"
								min="1"
								max="20"
								value={lesson.length}
								class="h-7 w-16"
								onchange={(e) => e.currentTarget.form?.requestSubmit()}
							/>
							<span class="text-muted-foreground">Periods</span>
						</div>

						<label for="lesson-topic" class="text-muted-foreground">Topic</label>
						{#if data.topic}
							<form
								method="POST"
								action="?/moveLessonToTopic"
								use:enhance={() => {
									// The page stays on the Lesson across the move; the reload that follows
									// makes the breadcrumb show the new Topic.
									return async ({ update }) => update({ reset: false });
								}}
							>
								<input type="hidden" name="id" value={lesson.id} />
								<select
									id="lesson-topic"
									name="topicId"
									value={data.topic.id}
									class="w-full rounded-md border border-input bg-background px-2 py-1 text-sm pointer-coarse:min-h-11"
									onchange={(e) => e.currentTarget.form?.requestSubmit()}
								>
									{#each data.topics as t (t.id)}
										<option value={t.id}>{t.name}</option>
									{/each}
								</select>
							</form>
						{:else}
							<span id="lesson-topic">None</span>
						{/if}

						{#if data.taughtBy.length}
							<span class="text-muted-foreground">Taught by</span>
							<span class="text-xs">{data.taughtBy.map((c) => c.label).join(', ')}</span>
						{/if}
					</div>

					<section class="max-lg:order-4">
						{@render heading('Tags')}
						<div class="mt-1 flex flex-wrap gap-1">
							{#each data.tags as tag (tag.id)}
								<form method="POST" action="?/detachTag" use:enhance class="contents">
									<input type="hidden" name="lessonId" value={lesson.id} />
									<input type="hidden" name="tagId" value={tag.id} />
									<TagBadge name={tag.name}>
										<button
											type="submit"
											class="-mr-0.5 ml-0.5 rounded-full hover:opacity-70"
											aria-label="Remove {tag.name}"
										>
											<XIcon class="size-3" />
										</button>
									</TagBadge>
								</form>
							{/each}
							{#if !data.tags.length}
								<span class="px-1 py-1 text-xs text-muted-foreground">No Tags yet.</span>
							{/if}
						</div>

						{#if addingTag}
							<form
								method="POST"
								action="?/attachTag"
								class="mt-2 flex gap-1"
								use:enhance={() => {
									return async ({ result, update }) => {
										await update();
										if (result.type === 'success') addingTag = false;
									};
								}}
							>
								<input type="hidden" name="lessonId" value={lesson.id} />
								<Input
									autofocus
									name="name"
									required
									autocomplete="off"
									list="existing-tag-names"
									class="h-7 min-w-0 flex-1 text-xs md:text-xs"
									placeholder="Tag name"
								/>
								<Button type="submit" size="sm" class="shrink-0">Add</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									class="shrink-0"
									onclick={() => (addingTag = false)}
								>
									Cancel
								</Button>
							</form>
						{:else}
							<Button
								type="button"
								variant="ghost"
								size="sm"
								class="mt-2 text-xs text-muted-foreground"
								onclick={() => (addingTag = true)}
							>
								+ Add Tag
							</Button>
						{/if}

						<datalist id="existing-tag-names">
							{#each data.existingTagNames as name (name)}
								<option value={name}></option>
							{/each}
						</datalist>
					</section>
				</div>

				<div class="grid gap-5 max-lg:order-4 sm:grid-cols-2 lg:grid-cols-1">
					<section>
						{@render heading('Links')}
						<ul class="mt-1 space-y-1">
							{#each data.lesson.links as link, i (link.id)}
								<li class="rounded-md bg-muted px-2 py-1.5 text-sm">
									<LinkRow
										{link}
										lessonId={lesson.id}
										first={i === 0}
										last={i === data.lesson.links.length - 1}
									/>
								</li>
							{/each}
							{#if !data.lesson.links.length}
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
									class="h-7 text-xs md:text-xs"
									placeholder="Label"
								/>
								<div class="flex gap-1">
									<Input
										name="url"
										type="url"
										required
										autocomplete="off"
										class="h-7 min-w-0 flex-1 text-xs md:text-xs"
										placeholder="https://…"
									/>
									<Button type="submit" size="sm" class="shrink-0">Add</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										class="shrink-0"
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
								class="mt-2 text-xs text-muted-foreground"
								onclick={() => (addingLink = true)}
							>
								+ Add Link
							</Button>
						{/if}
					</section>
					<section>
						{@render heading('Attachments')}
						<ul class="mt-1 space-y-1">
							{#each data.attachments as attachment (attachment.id)}
								<li class="rounded-md bg-muted px-2 py-1.5 text-sm">
									<AttachmentRow {attachment} />
								</li>
							{/each}
							{#if !data.attachments.length}
								<li class="px-1 py-1 text-xs text-muted-foreground">No Attachments yet.</li>
							{/if}
						</ul>

						<form
							method="POST"
							action="?/createAttachment"
							enctype="multipart/form-data"
							class="mt-2"
							use:enhance={onFail('Could not attach the file.')}
						>
							<input type="hidden" name="lessonId" value={lesson.id} />
							<input
								bind:this={fileInput}
								type="file"
								name="file"
								class="hidden"
								aria-label="Choose a file to attach"
								onchange={(e) => {
									const input = e.currentTarget;
									// Refused here, before the request ever starts: a file over the server's own
									// body-size cap would otherwise fail the request itself, and use:enhance turns
									// that into a full error page rather than this same readable toast.
									if ((input.files?.[0]?.size ?? 0) > MAX_ATTACHMENT_BYTES) {
										toast.error('Attachments are limited to 10 MB.');
										input.value = '';
										return;
									}
									// The submit snapshots the form data synchronously, so clearing here keeps the
									// upload in flight while letting a re-pick of the same file fire change again.
									input.form?.requestSubmit();
									input.value = '';
								}}
							/>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								class="text-xs text-muted-foreground"
								onclick={() => fileInput?.click()}
							>
								+ Add Attachment
							</Button>
						</form>
					</section>
				</div>

				<div class="border-t pt-3 max-lg:order-4">
					<form
						method="POST"
						action="?/deleteLesson"
						use:enhance={() => {
							return async ({ result, update }) => {
								if (result.type === 'success') {
									toast.success('Lesson deleted.');
									await back();
								} else if (result.type === 'failure') {
									toast.error(failureReason(result, 'Could not delete the Lesson.'));
								} else {
									await update();
								}
							};
						}}
					>
						<input type="hidden" name="id" value={lesson.id} />
						<Button
							type="submit"
							variant="ghost"
							size="sm"
							class="text-destructive hover:text-destructive"
						>
							<TrashIcon data-icon="inline-start" />
							Delete Lesson
						</Button>
					</form>
				</div>
			</aside>
		</div>
	{/key}
</div>
