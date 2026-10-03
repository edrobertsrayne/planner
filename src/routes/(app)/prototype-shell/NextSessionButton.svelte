<!--
	PROTOTYPE ONLY (issue #305): one tap to the next Session on the Agenda. Opens the real Session
	panel through the real `?session=` URL.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { encodeOccasion } from '$lib/client/session-panel.svelte';
	import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';
	import type { NextSession } from './nav';

	let {
		next,
		look = 'pill',
		class: className = ''
	}: {
		next: NextSession | null;
		look?: 'pill' | 'tab' | 'fab' | 'icon';
		class?: string;
	} = $props();

	function open() {
		if (!next) return;
		void goto(`/?session=${encodeOccasion(next)}`, { noScroll: true });
	}

	const when = $derived(
		next
			? `${new Date(`${next.date}T12:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} P${next.period}`
			: ''
	);
</script>

{#if look === 'tab'}
	<button
		type="button"
		data-session-trigger
		onclick={open}
		disabled={!next}
		class="flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium text-muted-foreground disabled:opacity-40 {className}"
	>
		<ClipboardListIcon class="size-5" />
		Next Session
	</button>
{:else if look === 'fab'}
	<button
		type="button"
		data-session-trigger
		onclick={open}
		disabled={!next}
		class="flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg disabled:opacity-40 {className}"
	>
		<ClipboardListIcon class="size-5" />
		{next ? `${next.classLabel} · ${when}` : 'No Session soon'}
	</button>
{:else if look === 'icon'}
	<button
		type="button"
		data-session-trigger
		onclick={open}
		disabled={!next}
		aria-label="Next Session"
		title={next ? `Next Session: ${next.classLabel}, ${when}` : 'No Session soon'}
		class="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted disabled:opacity-40 {className}"
	>
		<ClipboardListIcon class="size-4" />
	</button>
{:else}
	<button
		type="button"
		data-session-trigger
		onclick={open}
		disabled={!next}
		class="flex h-8 min-w-0 items-center gap-2 rounded-full border bg-card px-3 text-sm hover:bg-muted disabled:opacity-40 {className}"
	>
		<ClipboardListIcon class="size-4 shrink-0" />
		<span class="truncate">
			{#if next}
				<span class="text-muted-foreground">Next:</span>
				{next.classLabel} · {when}
			{:else}
				No Session soon
			{/if}
		</span>
	</button>
{/if}
