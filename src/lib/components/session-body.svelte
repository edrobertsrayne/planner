<script lang="ts">
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { formatWeekday } from '$lib/date';
	import type { Occasion } from '$lib/client/session-href';
	import { createTeachingNotes } from '$lib/client/teaching-note';
	import type { SessionDetail, WriteReport } from '$lib/server/planner';
	import RewindReport from '$lib/components/rewind-report.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { touchTarget } from '$lib/components/ui/touch-target';
	import LessonChildren from '$lib/components/lesson-children.svelte';
	import TagChips from '$lib/components/tag-chips.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import Markdown from '$lib/components/markdown.svelte';
	import MarkdownEditor from '$lib/components/markdown-editor.svelte';

	// The Session page's body. The occasion comes from the page's address, so the page remounts
	// the body for another Session and no state carries over.
	let { occasion }: { occasion: Occasion } = $props();

	// The note's persistence rules (issue #89) live in the module; here they meet the exits.
	// Every exit — Back, a link out, switching Session — unmounts the body or re-runs the effect
	// below, so the effect cleanup is the one flush point for them all;
	// closing the tab has no Svelte hook, so pagehide covers it. None of them waits for the
	// write, and there is no unsaved-changes prompt anywhere.
	const notes = createTeachingNotes({
		// keepalive lets a flush fired from pagehide — closing the tab — reach the server
		// through teardown; notes are small, so the request fits the keepalive budget.
		write: async (target, value) => {
			const r = await fetch('/session', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ ...target, note: value }),
				keepalive: true
			});
			if (!r.ok) throw new Error(`Save failed: ${r.status}`);
		},
		onFailure: () =>
			toast.error("Couldn't save your note", {
				description: 'It is kept on this device and will be here when you reopen this Session.'
			})
	});

	// The one load, in the four states the panel draws: still loading, no such Session, a load that
	// failed, or the detail.
	type LoadState =
		| { state: 'loading' }
		| { state: 'missing' }
		| { state: 'failed' }
		| { state: 'ready'; detail: SessionDetail };
	let load = $state<LoadState>({ state: 'loading' });
	const detail = $derived(load.state === 'ready' ? load.detail : null);
	// A Session that has started — the server's today or earlier — puts the note before the plan on
	// a phone.
	const started = $derived(detail !== null && occasion.date <= detail.today);

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
	let note = $state('');
	let continuationReport = $state<WriteReport | null>(null);
	let placeTitle = $state('');

	// Take a fresh detail. The note belongs to the Lesson, not the occasion, so when a response
	// changes the Lesson shown (Place, Remove placement, a Continuation moving the schedule),
	// the note is reopened for the new Lesson.
	function showDetail(d: SessionDetail) {
		const before = detail?.lesson?.id ?? null;
		load = { state: 'ready', detail: d };
		if ((d.lesson?.id ?? null) === before) return;
		note = d.lesson ? notes.open({ ...occasion, lessonId: d.lesson.id }, d.note) : '';
	}

	$effect(() => {
		const { classId, date, period } = occasion;
		fetch(`/session?classId=${encodeURIComponent(classId)}&date=${date}&period=${period}`)
			.then((r) => {
				if (!r.ok) throw r.status;
				return r.json();
			})
			.then((d: SessionDetail) => showDetail(d))
			.catch((status) => {
				// 400/404 mean the occasion names no Session (a period that is not a whole number,
				// an unknown Class). Anything else is a load that failed — a dropped connection, a
				// server fault — and a draft note still waits in storage for the next load.
				load = { state: status === 400 || status === 404 ? 'missing' : 'failed' };
			});
		return () => notes.flush();
	});

	// The four writes share one shape: a JSON body out, a detail back, a refusal that carries the
	// reason to show, and one busy slot at a time. `run` is that shape once. The page remounts this
	// body for each occasion, so an answer always belongs to the Session on screen and needs no
	// staleness check.
	async function run(
		kind: WriteKind,
		request: () => Promise<SessionDetail & { report?: WriteReport }>,
		onDone?: (answer: SessionDetail & { report?: WriteReport }) => void
	) {
		notes.flush();
		pending = kind;
		errors[kind] = null;
		try {
			const answer = await request();
			showDetail(answer);
			onDone?.(answer);
		} catch (e) {
			errors[kind] = (e as Error).message;
		} finally {
			pending = null;
		}
	}

	async function post(
		url: string,
		method: 'POST' | 'DELETE',
		body: unknown
	): Promise<SessionDetail & { report?: WriteReport }> {
		const r = await fetch(url, {
			method,
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!r.ok) throw new Error((await r.json().catch(() => null))?.message ?? 'Failed.');
		return r.json();
	}

	function markContinuation() {
		continuationReport = null;
		return run(
			'continue',
			() => post('/session/continuation', 'POST', occasion),
			(answer) => {
				continuationReport = answer.report ?? null;
				toast.success('Lesson continued onto the next Available Slot.');
			}
		);
	}

	function removeContinuationNow() {
		continuationReport = null;
		return run(
			'uncontinue',
			() => post('/session/continuation', 'DELETE', occasion),
			(answer) => {
				continuationReport = answer.report ?? null;
				toast.success('Continuation removed.');
			}
		);
	}

	function placeLessonNow() {
		const title = placeTitle.trim();
		if (!title) return;
		return run(
			'place',
			() => post('/session/placement', 'POST', { ...occasion, title }),
			() => (placeTitle = '')
		);
	}

	function removePlacementNow() {
		const id = detail?.placement?.id;
		if (!id) return;
		return run('unplace', () => post('/session/placement', 'DELETE', { ...occasion, id }));
	}
</script>

<div class="flex flex-wrap items-center gap-2">
	{#if detail}
		<!-- Opens the Class's page. The badge clips its content, so the touch hit area needs it to
		     overflow. -->
		<Badge
			variant="outline"
			href={resolve(`/classes/${detail.classId}`)}
			class="overflow-visible {touchTarget}">{detail.classLabel}</Badge
		>
	{/if}
	<span class="text-xs text-muted-foreground">
		{formatWeekday(occasion.date)} · P{occasion.period}
	</span>
	{#if detail && occasion.date >= detail.today && detail.ready !== null}
		<Badge variant="outline" class="text-xs {detail.ready ? '' : 'text-muted-foreground'}">
			{detail.ready ? 'Ready' : 'Not ready'}
		</Badge>
	{/if}
</div>

{#if detail}
	<div class="mt-4 flex flex-wrap items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			{#if detail.lesson}
				<h2 class="text-lg leading-snug font-semibold">{detail.lesson.title}</h2>
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
			<section data-plan class="min-w-0 lg:order-1 {started ? 'order-2' : 'order-1'}">
				{#if detail.lesson.body}
					<Markdown source={detail.lesson.body} />
				{:else}
					<p class="text-sm text-muted-foreground italic">
						No plan written yet — a title alone is a complete Lesson.
					</p>
				{/if}

				<LessonChildren
					links={detail.lesson.links}
					attachments={detail.lesson.attachments}
					variant="inline"
				/>
			</section>
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
				<div>
					<Button
						variant="outline"
						size="sm"
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
				<div class="rounded-lg border border-dashed p-3">
					<h3 class="text-sm font-semibold">Place a Lesson</h3>
					<p class="mt-1 text-xs text-muted-foreground">
						A Lesson with no Topic, scheduled directly on this occasion. It will not be part of
						{detail.classLabel}'s Course sequence.
						{#if detail.lesson}
							{detail.lesson.title} and every Lesson after it move to the next Available Slots.
						{/if}
					</p>
					<Input
						class="mt-2 h-8 text-sm"
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
						size="sm"
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
{:else if load.state === 'missing'}
	<p class="mt-4 text-sm text-muted-foreground">No such Session.</p>
{:else if load.state === 'failed'}
	<p class="mt-4 text-sm text-muted-foreground">
		Couldn't load this Session. Check your connection and reload.
	</p>
{:else}
	<!-- The fetch is the whole body, so without this the page reads as an empty Session. -->
	<p class="mt-4 text-sm text-muted-foreground">Loading…</p>
{/if}

<svelte:window onpagehide={() => notes.flush()} />
