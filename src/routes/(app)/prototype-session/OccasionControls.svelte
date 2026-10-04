<!--
	PROTOTYPE ONLY (issue #311): the acts on the occasion — Needs more time (Continuation), Place a
	Lesson and Remove placement. `only` picks one, so a variant can put each where it likes.
-->
<script lang="ts">
	import { place, removePlacement, toggleContinuation, type Detail } from './store.svelte';

	let { d, only }: { d: Detail; only?: 'continuation' | 'place' | 'remove' } = $props();
	let title = $state('');
	const show = (k: string) => !only || only === k;

	function submit() {
		if (!title.trim()) return;
		place(d, title.trim());
		title = '';
	}
	const btn =
		'inline-flex h-11 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted md:h-8 md:text-xs';
</script>

<div class="space-y-4">
	{#if show('continuation') && d.row.lesson}
		<div>
			<button type="button" class={btn} onclick={() => toggleContinuation(d)}>
				{d.continued ? 'Marked: needs more time (undo)' : 'Needs more time'}
			</button>
			<p class="mt-1.5 text-xs text-muted-foreground">
				Widens this Lesson onto {d.row.classLabel}'s next Available Slot.
			</p>
		</div>
	{/if}

	{#if show('place') && d.canPlace}
		<div class="rounded-lg border border-dashed p-3">
			<h3 class="text-sm font-semibold">Place a Lesson</h3>
			<p class="mt-1 text-xs text-muted-foreground">
				A Lesson with no Topic, scheduled directly on this occasion.
				{#if d.row.lesson}{d.row.lesson.title} and every Lesson after it move to the next Available Slots.{/if}
			</p>
			<form
				class="mt-2 flex gap-2"
				onsubmit={(e) => {
					e.preventDefault();
					submit();
				}}
			>
				<input
					class="h-11 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm md:h-8"
					placeholder="Title"
					aria-label="Lesson title"
					bind:value={title}
				/>
				<button
					type="submit"
					class="h-11 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50 md:h-8 md:text-xs"
					disabled={!title.trim()}>Place</button
				>
			</form>
		</div>
	{/if}

	{#if show('remove') && d.placed}
		<button
			type="button"
			class="{btn} border-destructive/40 text-destructive hover:bg-destructive/10"
			onclick={() => removePlacement(d)}>Remove placement</button
		>
	{/if}
</div>
