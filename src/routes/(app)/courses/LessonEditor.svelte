<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { replaceQuery } from '$lib/client/enhance';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import XIcon from '@lucide/svelte/icons/x';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import LinkRow from './LinkRow.svelte';

	let {
		lesson,
		links,
		index,
		count,
		previousId,
		nextId,
		courseId,
		topicId,
		topics,
		taughtBy
	}: {
		lesson: {
			id: string;
			title: string;
			body: string | null;
			status: 'draft' | 'planned';
			length: number;
		};
		links: { id: string; label: string; url: string }[];
		index: number;
		count: number;
		previousId: string | null;
		nextId: string | null;
		courseId: string;
		topicId: string;
		topics: { id: string; name: string }[];
		taughtBy: { id: string; label: string }[];
	} = $props();

	function hrefFor(lessonId: string | null) {
		if (page.url.pathname.startsWith('/planning')) {
			return lessonId ? `?lesson=${lessonId}` : '/planning';
		}
		const base = `?course=${courseId}&topic=${topicId}`;
		return lessonId ? `${base}&lesson=${lessonId}` : base;
	}

	async function step(lessonId: string | null) {
		if (!lessonId) return;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- carries a query string
		await goto(hrefFor(lessonId), { replaceState: true, noScroll: true, keepFocus: true });
	}

	async function close() {
		// Title and body save on blur — blurring first, before the Lesson unmounts, is what
		// commits a pending edit when Ed closes with Escape mid-field rather than by clicking away.
		(document.activeElement as HTMLElement | null)?.blur();
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- carries a query string
		await goto(hrefFor(null), { replaceState: true, noScroll: true, keepFocus: true });
	}

	let statusInput: HTMLInputElement | null = $state(null);
	let addingLink = $state(false);

	// The Dialog starts open every time this component mounts — it only exists while a Lesson is
	// selected. Escape, overlay-click and the close button all flow through bits-ui setting this to
	// false, which the effect below turns into the same URL-driven close as every other exit.
	let dialogOpen = $state(true);

	$effect(() => {
		if (!dialogOpen) close();
	});

	function onkeydown(e: KeyboardEvent) {
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
</script>

<svelte:window {onkeydown} />

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Content
		class="flex max-h-[85vh] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
		showCloseButton={false}
	>
		<Dialog.Title class="sr-only">Edit Lesson</Dialog.Title>

		<div class="flex items-center gap-3 border-b px-6 py-3">
			<span class="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
				Lesson {index + 1} of {count}
			</span>
			<span class="ml-auto flex items-center gap-0.5">
				<Button
					variant="ghost"
					size="icon-sm"
					disabled={!previousId}
					onclick={() => step(previousId)}
					aria-label="Previous Lesson"
				>
					<ChevronUpIcon class="size-3.5" />
				</Button>
				<Button
					variant="ghost"
					size="icon-sm"
					disabled={!nextId}
					onclick={() => step(nextId)}
					aria-label="Next Lesson"
				>
					<ChevronDownIcon class="size-3.5" />
				</Button>
				<Dialog.Close>
					{#snippet child({ props })}
						<Button {...props} variant="ghost" size="icon-sm" aria-label="Close">
							<XIcon class="size-3.5" />
						</Button>
					{/snippet}
				</Dialog.Close>
			</span>
		</div>

		<div
			class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_18rem] gap-6 overflow-y-auto px-6 pt-2 pb-6"
		>
			<!-- title, body and Length save together as one Lesson write; Links are their own
			     forms and so cannot nest inside this one — `contents` keeps this form's fields as
			     direct grid items instead of a wrapping box. -->
			<form
				method="POST"
				action="?/updateLesson"
				class="contents"
				use:enhance={() => {
					return async ({ update }) => {
						// The fields save without unmounting, unlike a create-and-clear form — a reset
						// here would blank a field whose defaultValue was never set, since it's bound
						// with `value`, not `bind:value`.
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
						class="h-auto w-full border-0 bg-transparent px-0 pt-4 pb-2 text-xl font-semibold tracking-tight shadow-none focus-visible:ring-0 md:text-xl"
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
						Length
					</span>
					<div class="mt-1 flex items-center gap-2">
						<Input
							type="number"
							name="length"
							min="1"
							value={lesson.length}
							class="h-7 w-16"
							onchange={(e) => e.currentTarget.form?.requestSubmit()}
						/>
						<span class="text-sm text-muted-foreground">Periods</span>
					</div>
				</label>
			</form>

			<div>
				<span class="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
					Planning status
				</span>
				<form method="POST" action="?/setLessonStatus" class="mt-1" use:enhance>
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
			</div>

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
							// The Lesson stays open across the move, so the editor follows it to its new
							// Topic rather than closing.
							return async ({ formData, result, update }) => {
								if (result.type !== 'success') return update();
								const newTopicId = String(formData.get('topicId'));
								if (page.url.pathname.startsWith('/planning')) {
									await replaceQuery(`?lesson=${lesson.id}`);
								} else {
									await replaceQuery(`?course=${courseId}&topic=${newTopicId}&lesson=${lesson.id}`);
								}
							};
						}}
					>
						<input type="hidden" name="id" value={lesson.id} />
						<select
							name="topicId"
							value={topicId}
							class="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
							onchange={(e) => e.currentTarget.form?.requestSubmit()}
						>
							{#each topics as t (t.id)}
								<option value={t.id}>{t.name}</option>
							{/each}
						</select>
					</form>
				</label>

				{#if taughtBy.length}
					<p class="mt-2 text-[11px] text-muted-foreground">
						Taught by {taughtBy.map((c) => c.label).join(', ')}.
					</p>
				{/if}
			</div>

			<div class="min-h-0 overflow-y-auto">
				<span class="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
					Links
				</span>
				<ul class="mt-1 space-y-1">
					{#each links as link, i (link.id)}
						<li class="rounded-md bg-muted px-2 py-1.5 text-sm">
							<LinkRow {link} lessonId={lesson.id} first={i === 0} last={i === links.length - 1} />
						</li>
					{/each}
					{#if !links.length}
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
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
