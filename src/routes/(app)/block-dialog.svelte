<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { formatWeekday } from '$lib/date';

	// PROTOTYPE: the note dialog for blocking one Slot from the Agenda. Mirrors the Calendar's
	// BlockNoteDialog (the note is required, because a hole in the week is otherwise unexplainable
	// months later) but opens from the row itself. The pick carries the row; saving is faked by
	// the page until the Agenda gets its own blockSlot action.
	export interface Pick {
		key: string;
		classLabel: string;
		date: string;
		period: number;
		lessonTitle: string | null;
	}

	let {
		pick = $bindable(null),
		onblock
	}: { pick: Pick | null; onblock: (pick: Pick, note: string) => void } = $props();

	let note = $state('');
	const label = $derived(pick ? `Block ${pick.classLabel}, P${pick.period}` : '');
</script>

<Dialog.Root
	open={pick !== null}
	onOpenChange={(open) => {
		if (!open) {
			pick = null;
			note = '';
		}
	}}
>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>{label}</Dialog.Title>
			<Dialog.Description>
				{pick ? formatWeekday(pick.date) : ''}. The Class is not taught this Period; the school is
				open.
			</Dialog.Description>
		</Dialog.Header>
		<form
			onsubmit={(e) => {
				e.preventDefault();
				if (pick && note.trim()) {
					onblock(pick, note.trim());
					pick = null;
					note = '';
				}
			}}
		>
			<Input bind:value={note} aria-label="{label}: why" required placeholder="Why (required)" />
			{#if pick?.lessonTitle}
				<p class="mt-2 text-xs text-muted-foreground">
					“{pick.lessonTitle}” moves to this Class's next Available Slot, and every Lesson after it
					moves along.
				</p>
			{:else}
				<p class="mt-2 text-xs text-muted-foreground">
					This Period has no Lesson, so nothing moves.
				</p>
			{/if}
			<Dialog.Footer>
				<Button type="submit">Block</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
