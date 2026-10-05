<script lang="ts">
	import { enhance } from '$app/forms';
	import { failureReason } from '$lib/client/enhance';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { AvailableSlotLine } from './calendar-grid';

	// The note form for blocking one Slot, opened from its day menu. A dialog, not a popover
	// over the tile, so it works by touch as by mouse (issue #345) and cannot be clipped by the
	// grid's edges. Its only caller is the block-Slot case, so the case is what it takes — the
	// picked Slot — and the action, the fields and the wording are the component's own. The
	// note is the whole point of a Blocked Slot — a hole in the week is otherwise unexplainable
	// months later — so it is required.
	//
	// Mounted once, closed and opened through the bound pick, the way ConfirmDeleteDialog is:
	// `pick` null is closed, a picked Slot is open. The page owns the pick; writing it null
	// here closes the dialog through its binding, and bits-ui hands focus back to where the
	// dialog found it — the day's menu trigger.
	let {
		pick = $bindable(null)
	}: {
		pick: (AvailableSlotLine & { date: string }) | null;
	} = $props();

	const label = $derived(pick ? `Block ${pick.classLabel}, P${pick.period}` : '');
	// The server's refusal — a note of spaces only passes the browser's required check but not
	// the seam's — named under the field, so the teacher can correct what they typed. A
	// refusal must not outlive its form: the message dies when the next pick opens.
	let error = $state<string | null>(null);
	$effect(() => {
		if (pick !== null) error = null;
	});
</script>

<Dialog.Root
	open={pick !== null}
	onOpenChange={(open) => {
		if (!open) pick = null;
	}}
>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>{label}</Dialog.Title>
			<Dialog.Description
				>The Class is not taught this Period; the school is open.</Dialog.Description
			>
		</Dialog.Header>
		<form
			method="POST"
			action="?/blockSlot"
			use:enhance={() =>
				async ({ result, update }) => {
					// reset stays manual: a failed action (the server rejects the note) must leave the
					// dialog open with what was typed still in it, not silently discarded.
					await update({ invalidateAll: true, reset: false });
					if (result.type === 'success') pick = null;
					else if (result.type === 'failure')
						error = failureReason(result, 'The block was refused.');
				}}
		>
			{#if pick}
				<input type="hidden" name="classId" value={pick.classId} />
				<input type="hidden" name="date" value={pick.date} />
				<input type="hidden" name="slotId" value={pick.slotId} />
			{/if}
			<Input name="note" aria-label={label} required placeholder="Why (required)" />
			{#if error}
				<p role="alert" class="mt-1.5 text-xs text-destructive">{error}</p>
			{/if}
			<Dialog.Footer>
				<Button type="submit">Block</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
