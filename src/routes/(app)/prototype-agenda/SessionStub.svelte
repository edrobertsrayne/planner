<!--
	PROTOTYPE ONLY (issue #310): a stand-in for the Session panel, so a row has somewhere to go.
	Where and how the panel shows is issue #311; do not judge it here.
-->
<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import { formatWeekday } from '$lib/date';
	import ClassChip from '../planning/prototype/ClassChip.svelte';
	import TagChips from '$lib/components/tag-chips.svelte';
	import Tick from './Tick.svelte';
	import { notes, rowByKey, sessionParam, set, TODAY } from './store.svelte';

	const row = $derived(rowByKey(sessionParam()));
	const close = () => set({ session: null });
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') close();
	}}
/>

{#if row}
	<aside
		class="fixed inset-x-0 top-(--shell-top) bottom-0 z-30 overflow-y-auto border-l bg-card p-5 shadow-xl md:left-auto md:w-96"
	>
		<div class="flex items-start gap-2">
			<div class="min-w-0 flex-1">
				<p class="text-xs text-muted-foreground">
					{formatWeekday(row.date)} · P{row.periodFrom}{#if row.periodTo !== row.periodFrom}–P{row.periodTo}{/if}
				</p>
				<div class="mt-1 flex items-center gap-2">
					<ClassChip label={row.classLabel} tone={row.tone} />
					<span class="font-semibold">{row.lesson?.title ?? 'Open Slot'}</span>
				</div>
				{#if row.lesson}
					<p class="mt-0.5 text-xs text-muted-foreground">
						{row.lesson.topicName ?? 'Standalone Lesson'}
					</p>
					<TagChips tags={row.lesson.tags} class="mt-1" />
				{/if}
			</div>
			<button
				type="button"
				class="rounded-md p-2 hover:bg-muted"
				aria-label="Close Session"
				onclick={close}><XIcon class="size-4" /></button
			>
		</div>
		{#if row.lesson && row.date >= TODAY}
			<div class="mt-4 flex items-center gap-2 text-sm">
				<Tick {row} labelled />
			</div>
		{/if}
		<label class="mt-4 block text-sm font-medium" for="note">Session notes</label>
		<textarea
			id="note"
			class="mt-1 min-h-32 w-full rounded-md border bg-background p-2 text-sm"
			bind:value={notes[row.key]}></textarea>
		<p class="mt-4 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
			Session panel stand-in. Its layout is the Session panel ticket (#311).
		</p>
	</aside>
{/if}
