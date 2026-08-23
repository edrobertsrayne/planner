<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { Occasion } from '$lib/client/session-panel.svelte';
	import type { SessionDetail } from '$lib/server/planner';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { Textarea } from '$lib/components/ui/textarea';

	// The one body every entry point renders (issue #88): plan first — the Lesson is the subject —
	// with "How it went" beneath it. The note saves on blur by whatever means it does today; the
	// autosave-and-flush rules are issue #89's.
	let { occasion }: { occasion: Occasion } = $props();

	let detail = $state<SessionDetail | null>(null);
	let note = $state('');
	let saved = $state(true);
	let saveFailed = $state(false);
	let continuing = $state(false);
	let continuationError = $state<string | null>(null);

	$effect(() => {
		const { classId, date, period } = occasion;
		let current = true;
		detail = null;
		continuing = false;
		continuationError = null;
		fetch(`/session?classId=${encodeURIComponent(classId)}&date=${date}&period=${period}`)
			.then((r) => r.json())
			.then((d: SessionDetail) => {
				// A later click on a different Session can resolve before this one — only apply the
				// response if it's still the occasion this effect was fetching for.
				if (!current) return;
				detail = d;
				note = d.note ?? '';
				saved = true;
				saveFailed = false;
				continuationError = null;
			});
		return () => {
			current = false;
		};
	});

	function saveNote() {
		const target = occasion;
		fetch('/session', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ...target, note })
		})
			.then((r) => {
				if (!r.ok) throw new Error(`Save failed: ${r.status}`);
				if (target === occasion) {
					saved = true;
					saveFailed = false;
				}
			})
			.catch(() => {
				if (target === occasion) {
					saved = false;
					saveFailed = true;
				}
			});
	}

	function markContinuation() {
		const target = occasion;
		continuing = true;
		continuationError = null;
		fetch('/session/continuation', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(target)
		})
			.then(async (r) => {
				if (!r.ok) throw new Error((await r.json().catch(() => null))?.message ?? 'Failed.');
				return r.json() as Promise<SessionDetail>;
			})
			.then((d) => {
				if (target !== occasion) return;
				detail = d;
				continuing = false;
				invalidateAll();
			})
			.catch((e: Error) => {
				if (target !== occasion) return;
				continuing = false;
				continuationError = e.message;
			});
	}

	const fmtLongDay = (iso: string) =>
		new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			timeZone: 'UTC'
		});
</script>

<div class="flex items-center gap-2">
	{#if detail}<Badge variant="outline">{detail.classLabel}</Badge>{/if}
	<span class="text-xs text-muted-foreground">
		{fmtLongDay(occasion.date)} · P{occasion.period}
	</span>
</div>

{#if detail}
	<Separator class="my-4" />

	{#if detail.lesson}
		<h2 class="text-lg leading-snug font-semibold">{detail.lesson.title}</h2>
		<p class="mt-1 text-xs text-muted-foreground">{detail.lesson.topicName}</p>

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
						<!-- eslint-disable svelte/no-navigation-without-resolve -- external resource -->
						<a
							href={link.url}
							target="_blank"
							rel="noopener noreferrer"
							class="text-sm underline underline-offset-4">{link.label}</a
						>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
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
		</div>
	{:else}
		<h2 class="text-lg font-semibold text-muted-foreground italic">Unplanned</h2>
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
		bind:value={note}
		oninput={() => {
			saved = false;
			saveFailed = false;
		}}
		onblur={saveNote}
	/>
	{#if saveFailed}
		<p class="mt-1 text-xs text-destructive">Couldn't save — try again.</p>
	{:else if !saved}
		<p class="mt-1 text-xs text-muted-foreground">Saving…</p>
	{/if}
{/if}
