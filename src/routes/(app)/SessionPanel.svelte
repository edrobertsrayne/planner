<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { Occasion } from '$lib/client/session-panel.svelte';
	import type { SessionDetail } from '$lib/server/planner';

	let { occasion, onclose }: { occasion: Occasion; onclose: () => void } = $props();

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

<aside class="w-96 shrink-0 overflow-y-auto border-l border-neutral-200 bg-white px-5 py-5">
	<div class="mb-4 flex items-start justify-between">
		<div>
			<span class="rounded bg-neutral-100 px-2 py-0.5 text-sm font-bold ring-1 ring-neutral-300">
				{detail?.classLabel ?? ''}
			</span>
			<div class="mt-2 text-xs text-neutral-500">
				{fmtLongDay(occasion.date)} · P{occasion.period}
			</div>
		</div>
		<button
			type="button"
			class="text-neutral-400 hover:text-neutral-900"
			onclick={onclose}
			aria-label="Close">✕</button
		>
	</div>

	{#if detail}
		{#if detail.lesson}
			<h2 class="text-lg leading-snug font-semibold">{detail.lesson.title}</h2>
			<div class="mt-1 text-xs text-neutral-500">{detail.lesson.topicName}</div>

			{#if detail.lesson.body}
				<div
					class="mt-4 border-t border-neutral-100 pt-4 text-sm whitespace-pre-line text-neutral-700"
				>
					{detail.lesson.body}
				</div>
			{:else}
				<p class="mt-4 border-t border-neutral-100 pt-4 text-sm text-neutral-400 italic">
					No plan written yet — a title alone is a complete Lesson.
				</p>
			{/if}

			{#if detail.lesson.links.length}
				<ul class="mt-4 space-y-1">
					{#each detail.lesson.links as link (link.id)}
						<li>
							<!-- eslint-disable svelte/no-navigation-without-resolve -- external resource link -->
							<a
								href={link.url}
								target="_blank"
								rel="noopener noreferrer"
								class="text-sm text-sky-700 underline">{link.label}</a
							>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						</li>
					{/each}
				</ul>
			{/if}

			<div class="mt-4 border-t border-neutral-100 pt-4">
				<button
					type="button"
					class="rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
					disabled={continuing}
					onclick={markContinuation}
				>
					{continuing ? 'Marking…' : 'Needs more time'}
				</button>
				<p class="mt-1 text-[11px] text-neutral-400">
					Widens this Lesson onto the Class's next Available Slot.
				</p>
				{#if continuationError}
					<p class="mt-1 text-[11px] text-red-600">{continuationError}</p>
				{/if}
			</div>
		{:else}
			<h2 class="text-lg leading-snug font-semibold text-neutral-400 italic">Unplanned</h2>
			<p class="mt-1 text-xs text-neutral-500">No Lesson planned for this occasion.</p>
		{/if}

		<div class="mt-6 border-t border-neutral-100 pt-4">
			<div class="mb-1 flex items-baseline justify-between">
				<label
					for="session-note"
					class="text-xs font-bold tracking-wider text-neutral-400 uppercase"
				>
					How it went
				</label>
				<span class="text-[11px] text-neutral-400">stays with the occasion</span>
			</div>
			<textarea
				id="session-note"
				class="w-full rounded border border-neutral-300 p-2 text-sm"
				rows="6"
				placeholder="Notes on this Session…"
				bind:value={note}
				oninput={() => {
					saved = false;
					saveFailed = false;
				}}
				onblur={saveNote}></textarea>
			{#if saveFailed}
				<p class="mt-1 text-[11px] text-red-600">Couldn't save — try again.</p>
			{:else if !saved}
				<p class="mt-1 text-[11px] text-neutral-400">Saving…</p>
			{/if}
		</div>
	{/if}
</aside>
