<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { formatWeekday } from '$lib/date';
	import { formatSize } from '$lib/format-size';
	import type { Occasion } from '$lib/client/session-panel.svelte';
	import { createSessionNotes } from '$lib/client/session-note';
	import type { AtRiskSession, SessionDetail } from '$lib/server/planner';
	import AtRiskAlert from '$lib/components/at-risk-alert.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { Textarea } from '$lib/components/ui/textarea';

	// The one body every entry point renders (issue #88): plan first — the Lesson is the subject —
	// with "How it went" beneath it.
	let { occasion }: { occasion: Occasion } = $props();

	// The note's persistence rules (issue #89) live in the module; here they meet the exits.
	// Every dismissal — click-away, Escape, ✕, Back, switching Session — unmounts the panel or
	// re-runs the effect below, so the effect cleanup is the one flush point for them all;
	// closing the tab has no Svelte hook, so pagehide covers it. None of them waits for the
	// write, and there is no unsaved-changes prompt anywhere.
	const notes = createSessionNotes({
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

	let detail = $state<SessionDetail | null>(null);
	let note = $state('');
	let continuing = $state(false);
	let continuationError = $state<string | null>(null);
	let continuationAtRisk = $state<AtRiskSession[]>([]);

	$effect(() => {
		const { classId, date, period } = occasion;
		let current = true;
		detail = null;
		continuing = false;
		continuationError = null;
		continuationAtRisk = [];
		fetch(`/session?classId=${encodeURIComponent(classId)}&date=${date}&period=${period}`)
			.then((r) => r.json())
			.then((d: SessionDetail) => {
				// A later click on a different Session can resolve before this one — only apply the
				// response if it's still the occasion this effect was fetching for.
				if (!current) return;
				detail = d;
				note = notes.open(occasion, d.note);
				continuationError = null;
			})
			.catch(() => {
				// The panel has nothing to show without its Session; a silent miss beats an
				// unhandled rejection. Any draft still waits in storage for a better reconnect.
			});
		return () => {
			current = false;
			notes.flush();
		};
	});

	function markContinuation() {
		const target = occasion;
		continuing = true;
		continuationError = null;
		continuationAtRisk = [];
		fetch('/session/continuation', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(target)
		})
			.then(async (r) => {
				if (!r.ok) throw new Error((await r.json().catch(() => null))?.message ?? 'Failed.');
				return r.json() as Promise<SessionDetail & { atRisk: AtRiskSession[] }>;
			})
			.then((d) => {
				if (target !== occasion) return;
				detail = d;
				continuing = false;
				continuationAtRisk = d.atRisk;
				invalidateAll();
			})
			.catch((e: Error) => {
				if (target !== occasion) return;
				continuing = false;
				continuationError = e.message;
			});
	}
</script>

<div class="flex items-center gap-2">
	{#if detail}<Badge variant="outline">{detail.classLabel}</Badge>{/if}
	<span class="text-xs text-muted-foreground">
		{formatWeekday(occasion.date)} · P{occasion.period}
	</span>
	{#if detail?.ready !== null && detail?.ready !== undefined}
		<Badge variant="outline" class="ml-auto text-xs {detail.ready ? '' : 'text-muted-foreground'}">
			{detail.ready ? 'Ready' : 'Not ready'}
		</Badge>
	{/if}
</div>

{#if detail}
	<Separator class="my-4" />

	{#if detail.lesson}
		<h2 class="text-lg leading-snug font-semibold">{detail.lesson.title}</h2>
		{#if detail.lesson.topicName}
			<p class="mt-1 text-xs text-muted-foreground">{detail.lesson.topicName}</p>
		{/if}

		{#if detail.lesson.body}
			<p class="mt-4 text-sm whitespace-pre-line text-foreground/80">{detail.lesson.body}</p>
		{:else}
			<p class="mt-4 text-sm text-muted-foreground italic">
				No plan written yet — a title alone is a complete Lesson.
			</p>
		{/if}

		{#if detail.lesson.links.length}
			<ul class="mt-4 space-y-1">
				{#each detail.lesson.links as link (link.id)}
					<li>
						<a
							href={link.url}
							target="_blank"
							rel="noopener noreferrer"
							class="text-sm underline underline-offset-4">{link.label}</a
						>
					</li>
				{/each}
			</ul>
		{/if}

		{#if detail.lesson.attachments.length}
			<ul class="mt-2 space-y-1">
				{#each detail.lesson.attachments as attachment (attachment.id)}
					<li class="flex items-baseline gap-2 text-sm">
						<a
							href={resolve('/attachments/[id]', { id: attachment.id })}
							class="min-w-0 flex-1 truncate underline underline-offset-4"
						>
							{attachment.filename}
						</a>
						<span class="shrink-0 font-mono text-[10px] text-muted-foreground">
							{formatSize(attachment.size)}
						</span>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="mt-5">
			<Button variant="outline" size="sm" disabled={continuing} onclick={markContinuation}>
				{continuing ? 'Marking…' : 'Needs more time'}
			</Button>
			<p class="mt-1.5 text-xs text-muted-foreground">
				Widens this Lesson onto the Class's next Available Slot.
			</p>
			{#if continuationError}
				<p class="mt-1 text-xs text-destructive">{continuationError}</p>
			{/if}
			{#if continuationAtRisk.length > 0}
				<div class="mt-3">
					<AtRiskAlert atRisk={continuationAtRisk} />
				</div>
			{/if}
		</div>
	{:else}
		<h2 class="text-lg font-semibold text-muted-foreground italic">Open Slot</h2>
		<p class="mt-1 text-xs text-muted-foreground">No Lesson planned for this occasion.</p>
	{/if}

	<Separator class="my-5" />

	<div class="mb-1.5 flex items-baseline justify-between">
		<label
			for="session-note"
			class="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
			>How it went</label
		>
		<span class="text-xs text-muted-foreground">stays with the occasion</span>
	</div>
	<Textarea
		id="session-note"
		rows={6}
		placeholder="Notes on this Session…"
		value={note}
		oninput={(e) => {
			// Explicit value + handler rather than bind:value: the edit handed to notes must be
			// the text in this very event, not whatever the binding has caught up to.
			note = e.currentTarget.value;
			notes.edit(occasion, note);
		}}
	/>
{/if}

<svelte:window onpagehide={() => notes.flush()} />
