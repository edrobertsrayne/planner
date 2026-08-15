<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import LinkRow from './LinkRow.svelte';

	let {
		lesson,
		links,
		index,
		count,
		previousId,
		nextId,
		courseId,
		topicId
	}: {
		lesson: { id: string; title: string; body: string | null; plannedLength: number };
		links: { id: string; label: string; url: string }[];
		index: number;
		count: number;
		previousId: string | null;
		nextId: string | null;
		courseId: string;
		topicId: string;
	} = $props();

	function hrefFor(lessonId: string | null) {
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

	let addingLink = $state(false);

	function onkeydown(e: KeyboardEvent) {
		const el = document.activeElement as HTMLElement | null;
		const typing =
			el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
			return;
		}
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

<div
	class="fixed inset-0 z-40 flex items-center justify-center bg-neutral-900/40 p-6 sm:p-12"
	role="dialog"
	aria-modal="true"
>
	<div
		class="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
	>
		<div class="flex items-center gap-3 border-b border-neutral-200 px-6 py-3">
			<span class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
				Lesson {index + 1} of {count}
			</span>
			<span class="ml-auto flex items-center gap-0.5">
				<button
					type="button"
					class="rounded px-2 py-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-25"
					disabled={!previousId}
					onclick={() => step(previousId)}
					aria-label="Previous Lesson"
				>
					↑
				</button>
				<button
					type="button"
					class="rounded px-2 py-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-25"
					disabled={!nextId}
					onclick={() => step(nextId)}
					aria-label="Next Lesson"
				>
					↓
				</button>
			</span>
			<button
				type="button"
				class="ml-2 text-sm text-neutral-400 hover:text-neutral-900"
				onclick={close}
			>
				Done <span class="font-mono text-[11px]">esc</span>
			</button>
		</div>

		<div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_18rem] gap-6 px-6 pt-2 pb-6">
			<!-- title, body and Planned Length save together as one Lesson write; Links are their own
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
					<input
						name="title"
						value={lesson.title}
						required
						autocomplete="off"
						class="w-full border-0 px-0 pt-4 pb-2 text-xl font-semibold tracking-tight focus:ring-0 focus:outline-none"
						placeholder="Lesson title…"
						onblur={(e) => e.currentTarget.form?.requestSubmit()}
					/>
				</div>

				<label class="row-span-2 flex min-h-0 flex-col">
					<span class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
						Notes & objectives
					</span>
					<textarea
						name="body"
						class="mt-1.5 min-h-72 flex-1 resize-none rounded-lg border border-neutral-300 px-4 py-3 font-mono text-xs leading-relaxed focus:border-neutral-900 focus:outline-none"
						placeholder="Markdown — objectives, what to set up, what went wrong last time…"
						onblur={(e) => e.currentTarget.form?.requestSubmit()}>{lesson.body ?? ''}</textarea
					>
				</label>

				<label class="block">
					<span class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
						Planned Length
					</span>
					<div class="mt-1 flex items-center gap-2">
						<input
							type="number"
							name="plannedLength"
							min="1"
							value={lesson.plannedLength}
							class="w-16 rounded border border-neutral-300 px-2 py-1 text-sm"
							onchange={(e) => e.currentTarget.form?.requestSubmit()}
						/>
						<span class="text-sm text-neutral-500">Periods</span>
					</div>
				</label>
			</form>

			<div class="min-h-0 overflow-y-auto">
				<span class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase"> Links </span>
				<ul class="mt-1 space-y-1">
					{#each links as link, i (link.id)}
						<li class="rounded bg-neutral-50 px-2 py-1.5 text-sm">
							<LinkRow {link} lessonId={lesson.id} first={i === 0} last={i === links.length - 1} />
						</li>
					{/each}
					{#if !links.length}
						<li class="px-1 py-1 text-xs text-neutral-400">No Links yet.</li>
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
						<!-- svelte-ignore a11y_autofocus -->
						<input
							autofocus
							name="label"
							required
							autocomplete="off"
							class="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
							placeholder="Label"
						/>
						<div class="flex gap-1">
							<input
								name="url"
								type="url"
								required
								autocomplete="off"
								class="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-xs"
								placeholder="https://…"
							/>
							<button
								type="submit"
								class="shrink-0 rounded bg-neutral-900 px-2.5 text-xs text-white"
							>
								Add
							</button>
							<button
								type="button"
								class="shrink-0 rounded px-2.5 text-xs text-neutral-400 hover:text-neutral-900"
								onclick={() => (addingLink = false)}
							>
								Cancel
							</button>
						</div>
					</form>
				{:else}
					<button
						type="button"
						class="mt-2 text-xs text-neutral-500 hover:text-neutral-900"
						onclick={() => (addingLink = true)}
					>
						+ Add Link
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>
