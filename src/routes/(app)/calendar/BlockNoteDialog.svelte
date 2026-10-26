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
	type Pick = AvailableSlotLine & { date: string };

	let { pick = $bindable(null) }: { pick: Pick | null } = $props();

	// The pick the panel last opened on, kept only for the close animation: bits-ui leaves the
	// content mounted while it fades out, and `pick` is null by then. The open animation's
	// completion is where it is recorded.
	let shown = $state<Pick | null>(null);
	const viewed = $derived(pick ?? shown);
	const label = $derived(viewed ? `Block ${viewed.classLabel}, P${viewed.period}` : '');

	// The server's refusal — a note of spaces only passes the browser's required check but not
	// the seam's — is named under the field, kept with the pick it answers: a new pick is a new
	// object, so a refusal never outlives its form.
	let refusal = $state<{ pick: Pick; message: string } | null>(null);
	const error = $derived(refusal?.pick === pick ? refusal.message : null);
</script>

<Dialog.Root
	open={pick !== null}
	onOpenChange={(open) => {
		if (!open) pick = null;
	}}
	onOpenChangeComplete={(open) => {
		if (open) shown = pick;
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
					else if (result.type === 'failure' && pick)
						refusal = { pick, message: failureReason(result, 'The block was refused.') };
				}}
		>
			{#if viewed}
				<input type="hidden" name="classId" value={viewed.classId} />
				<input type="hidden" name="date" value={viewed.date} />
				<input type="hidden" name="slotId" value={viewed.slotId} />
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
