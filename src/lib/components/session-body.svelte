<script lang="ts">
	import { onDestroy } from 'svelte';
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ActionResult } from '@sveltejs/kit';
	import { toast } from '$lib/ui/toast';
	import { formatWeekday } from '$lib/date';
	import { failureReason, reportOfResult } from '$lib/client/enhance';
	import { sessionHref } from '$lib/client/session-href';
	import { createTeachingNotes } from '$lib/client/teaching-note';
	import type { SessionDetail, WriteReport } from '$lib/server/planner';
	import RewindReport from '$lib/components/rewind-report.svelte';
	import { Badge, Button, Input, touchTarget } from '$lib/ui';
	import LessonChildren from '$lib/components/lesson-children.svelte';
	import TagChips from '$lib/components/tag-chips.svelte';
	import Markdown from '$lib/components/markdown.svelte';
	import MarkdownEditor from '$lib/components/markdown-editor.svelte';

	// The Session page's body, drawn from the page's own load. The page remounts the body for
	// another Session, so no state carries over.
	let { detail }: { detail: SessionDetail } = $props();

	const occasion = $derived({
		classId: detail.classId,
		date: detail.date,
		period: detail.period
	});

	// Every write is one of the Session page's form actions, posted to the Session's own address:
	// a note flushed on the way out is sent after the browser's address has already changed.
	// svelte-ignore state_referenced_locally
	const address = sessionHref(detail);
	async function post(
		action: string,
		fields: Record<string, string> = {},
		keepalive = false
	): Promise<ActionResult> {
		const body = new FormData();
		for (const [name, value] of Object.entries(fields)) body.set(name, value);
		const response = await fetch(`${address}?/${action}`, {
			method: 'POST',
			body,
			keepalive,
			headers: { 'x-sveltekit-action': 'true' }
		});
		return deserialize(await response.text());
	}

	// The note's persistence rules (issue #89) live in the module; here they meet the exits.
	// Every exit — Back, a link out, switching Session — unmounts the body, so its teardown is the
	// one flush point for them all; closing the tab has no Svelte hook, so pagehide covers it.
	// None of them waits for the write, and there is no unsaved-changes prompt anywhere.
	const notes = createTeachingNotes({
		// keepalive lets a flush fired from pagehide — closing the tab — reach the server
		// through teardown; notes are small, so the request fits the keepalive budget.
		write: async (target, value) => {
			const result = await post('writeNote', { lessonId: target.lessonId, note: value }, true);
			if (result.type !== 'success') throw new Error('Save failed.');
		},
		onFailure: () =>
			toast.error("Couldn't save your note", {
				description: 'It is kept on this device and will be here when you reopen this Session.'
			})
	});
	onDestroy(() => notes.flush());

	// A Session that has started — the server's today or earlier — puts the note before the plan on
	// a phone.
	const started = $derived(detail.date <= detail.today);

	// The four writes share one busy slot and one error each; the panel shows the error that
	// belongs to the place it draws.
	type WriteKind = 'continue' | 'uncontinue' | 'place' | 'unplace';
	let pending = $state<WriteKind | null>(null);
	let errors = $state<Record<WriteKind, string | null>>({
		continue: null,
		uncontinue: null,
		place: null,
		unplace: null
	});
	let continuationReport = $state<WriteReport | null>(null);
	let placeTitle = $state('');

	// The note belongs to the Lesson, not the occasion, so when a write changes the Lesson shown
	// (Place, Remove placement, a Continuation moving the schedule), the note is reopened for the
	// new Lesson — before the editor, which is keyed on the Lesson, mounts again.
	const openNote = (shown: SessionDetail) =>
		shown.lesson ? notes.open({ ...occasion, lessonId: shown.lesson.id }, shown.note) : '';
	// svelte-ignore state_referenced_locally
	let noteOf = detail.lesson?.id ?? null;
	// svelte-ignore state_referenced_locally
	let note = $state(openNote(detail));
	$effect.pre(() => {
		const lessonId = detail.lesson?.id ?? null;
		if (lessonId === noteOf) return;
		noteOf = lessonId;
		note = openNote(detail);
	});

	// The four writes share one shape: a form action out, a refusal that carries the reason to
	// show, a fresh load on success, and one busy slot at a time. `run` is that shape once.
	async function run(
		kind: WriteKind,
		fields: Record<string, string> = {},
		onDone?: (result: ActionResult) => void
	) {
		notes.flush();
		pending = kind;
		errors[kind] = null;
		try {
			const result = await post(kind, fields);
			if (result.type !== 'success') {
				errors[kind] = failureReason(result, 'Failed.');
				return;
			}
			onDone?.(result);
			await invalidateAll();
		} catch {
			errors[kind] = 'Failed.';
		} finally {
			pending = null;
		}
	}

	function markContinuation() {
		continuationReport = null;
		return run('continue', {}, (result) => {
			continuationReport = reportOfResult(result);
			toast.success('Lesson continued onto the next Available Slot.');
		});
	}

	function removeContinuationNow() {
		continuationReport = null;
		return run('uncontinue', {}, (result) => {
			continuationReport = reportOfResult(result);
			toast.success('Continuation removed.');
		});
	}

	function placeLessonNow() {
		const title = placeTitle.trim();
		if (!title) return;
		return run('place', { title }, () => (placeTitle = ''));
	}

	function removePlacementNow() {
		const id = detail.placement?.id;
		if (!id) return;
		return run('unplace', { id });
	}
</script>

<div class="flex flex-wrap items-center gap-2">
	<!-- Opens the Class's page. The badge clips its content, so the touch hit area needs it to
	     overflow. -->
	<Badge
		variant="outline"
		href={resolve(`/classes/${detail.classId}`)}
		class="h-7 overflow-visible rounded-full px-3 text-[13px] {touchTarget}"
		>{detail.classLabel}</Badge
	>
	<span class="text-sm text-muted-foreground tabular-nums">
		{formatWeekday(detail.date)} · P{detail.period}
	</span>
	{#if detail.date >= detail.today && detail.ready !== null}
		<Badge
			variant="outline"
			class={detail.ready
				? 'border-transparent bg-ready text-ready-foreground'
				: 'text-muted-foreground'}
		>
			{detail.ready ? 'Ready' : 'Not ready'}
		</Badge>
	{/if}
</div>

<div class="mt-4 flex flex-wrap items-start justify-between gap-3">
	<div class="min-w-0 flex-1">
		{#if detail.lesson}
			<h2 class="text-[26px] leading-8 font-semibold tracking-tight md:text-[32px] md:leading-10">
				{detail.lesson.title}
			</h2>
			{#if detail.placement}
				<p class="mt-1 text-xs text-muted-foreground">Standalone Lesson · Placed</p>
			{:else if detail.lesson.topic}
				<p class="mt-1 text-xs text-muted-foreground">{detail.lesson.topic.name}</p>
			{/if}
			<TagChips tags={detail.lesson.tags.map((tag) => tag.name)} class="mt-2" />
		{:else}
			<h2 class="text-lg font-semibold text-muted-foreground italic">Open Slot</h2>
			<p class="mt-1 text-xs text-muted-foreground">No Lesson planned for this occasion.</p>
		{/if}
	</div>
	{#if detail.lesson}
		<Button variant="outline" size="sm" href={resolve(`/lessons/${detail.lesson.id}`)}>
			Open in Lesson editor
		</Button>
	{/if}
</div>

<!-- Below `lg` one column: the plan first for a Session still ahead, the note first once the
     Session has started. From `lg` the plan is on the left and the rail on the right. -->
<div class="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
	{#if detail.lesson}
		<div
			class="flex min-w-0 flex-col gap-4 self-start lg:order-1 {started ? 'order-2' : 'order-1'}"
		>
			<section data-plan class="min-w-0 rounded-2xl border bg-surface px-6 py-5">
				<h2 class="mb-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">Plan</h2>
				{#if detail.lesson.body}
					<Markdown source={detail.lesson.body} />
				{:else}
					<p class="text-sm text-muted-foreground italic">
						No plan written yet — a title alone is a complete Lesson.
					</p>
				{/if}
			</section>
			{#if detail.lesson.links.length || detail.lesson.attachments.length}
				<section class="min-w-0 rounded-2xl border bg-surface px-5 py-4">
					<h2 class="mb-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
						Links and attachments
					</h2>
					<LessonChildren
						links={detail.lesson.links}
						attachments={detail.lesson.attachments}
						variant="inline"
					/>
				</section>
			{/if}
		</div>
	{/if}

	<div class="flex min-w-0 flex-col gap-5 lg:order-2 {started ? 'order-1' : 'order-2'}">
		<!-- An Open Slot has no Lesson, so it has no note (ADR-0026). The editor takes its text
		     once, on mount, so it is keyed on the Lesson: placing a Lesson over a Topic Lesson,
		     or removing the placement, must show the note of the Lesson now on the occasion
		     rather than leave the last one's text to be saved over it (issue #409). -->
		{#if detail.lesson}
			{@const lessonId = detail.lesson.id}
			{#key lessonId}
				<section data-note>
					<div class="mb-1.5 flex items-baseline justify-between gap-2">
						<span class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
							How it went
						</span>
						{#if detail.placement}
							<Button
								variant="ghost"
								size="sm"
								class="h-6 px-2 text-xs text-destructive"
								disabled={pending !== null}
								onclick={removePlacementNow}
							>
								{pending === 'unplace' ? 'Removing…' : 'Remove placement'}
							</Button>
						{:else}
							<span class="text-xs text-muted-foreground">stays with the Lesson</span>
						{/if}
					</div>
					{#if errors.unplace}
						<p class="mb-1.5 text-xs text-destructive">{errors.unplace}</p>
					{/if}
					<MarkdownEditor
						value={note}
						label="How it went"
						placeholder="How it went with this Class…"
						onchange={(markdown) => {
							note = markdown;
							notes.edit({ ...occasion, lessonId }, markdown);
						}}
					/>
				</section>
			{/key}
		{/if}

		{#if detail.lesson && started}
			<div class="rounded-2xl border bg-surface p-4">
				<Button
					variant="outline"
					class="w-full"
					disabled={pending !== null}
					onclick={markContinuation}
				>
					{pending === 'continue' ? 'Marking…' : 'Needs more time'}
				</Button>
				<p class="mt-1.5 text-xs text-muted-foreground">
					Widens this Lesson onto the Class's next Available Slot.
				</p>
				{#if detail.continuations > 0}
					<div class="mt-2 flex items-center justify-between gap-2">
						<p class="text-xs" role="status">
							Continued onto {detail.continuations} more {detail.continuations === 1
								? 'Session'
								: 'Sessions'}.
						</p>
						<Button
							variant="ghost"
							size="sm"
							class="h-6 px-2 text-xs"
							disabled={pending !== null}
							onclick={removeContinuationNow}
						>
							{pending === 'uncontinue' ? 'Removing…' : 'Remove one'}
						</Button>
					</div>
				{/if}
				{#if errors.continue || errors.uncontinue}
					<p class="mt-1 text-xs text-destructive">{errors.continue ?? errors.uncontinue}</p>
				{/if}
				<div class="mt-3 empty:hidden">
					<RewindReport report={continuationReport} />
				</div>
			</div>
		{/if}

		<!-- One card, on an Open Slot and on an occasion a Topic Lesson already holds alike (issue
		     #256) — a Placement claims its Slot ahead of the Topic stream, so the Lesson there and
		     every Lesson after it shift right. `canPlace` (sessions.ts) is the whole gate: future or
		     today, and no Placement anchored here already. -->
		{#if detail.canPlace}
			<div class="rounded-2xl border border-dashed bg-surface p-4">
				<h3 class="text-sm font-semibold">Place a Lesson</h3>
				<p class="mt-1 text-xs text-muted-foreground">
					A Lesson with no Topic, scheduled directly on this occasion. It will not be part of
					{detail.classLabel}'s Course sequence.
					{#if detail.lesson}
						{detail.lesson.title} and every Lesson after it move to the next Available Slots.
					{/if}
				</p>
				<Input
					class="mt-2"
					placeholder="Title"
					aria-label="Lesson title"
					value={placeTitle}
					oninput={(e) => (placeTitle = e.currentTarget.value)}
					onkeydown={(e) => {
						if (e.key === 'Enter') placeLessonNow();
					}}
				/>
				<Button
					class="mt-2"
					disabled={pending !== null || !placeTitle.trim()}
					onclick={placeLessonNow}
				>
					{pending === 'place' ? 'Placing…' : 'Place'}
				</Button>
				{#if errors.place}
					<p class="mt-1.5 text-xs text-destructive">{errors.place}</p>
				{/if}
			</div>
		{/if}
	</div>
</div>

<svelte:window onpagehide={() => notes.flush()} />
