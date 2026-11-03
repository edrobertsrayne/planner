<script lang="ts">
	import { enhance } from '$app/forms';
	import { failureReason } from '$lib/client/enhance';
	import { latched } from '$lib/client/latch.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { formatWeekday } from '$lib/date';

	// The form for blocking a whole day, opened from an Agenda day heading. Mounted once and opened
	// through the bound date, as BlockSlotDialog is: `date` null is closed. Unlike a Blocked Slot a
	// Blocked Day's note is optional, because the cause is not recorded: INSET, snow and illness
	// all read the same. `lessons` is the page's count of the day's rows, so the dialog can say how
	// much moves.
	let { date = $bindable(null), lessons }: { date: string | null; lessons: number } = $props();

	// The date the dialog last opened on, kept only for the close animation.
	const shown = latched(() => date);
	const viewed = $derived(shown());
	const label = $derived(viewed ? `Block ${formatWeekday(viewed)}` : '');

	// A refusal (a stale tab, a day already blocked) is named under the field, kept with the date
	// it answers so it never outlives its form.
	let refusal = $state<{ date: string; message: string } | null>(null);
	const error = $derived(refusal && refusal.date === date ? refusal.message : null);
</script>

<Dialog.Root
	open={date !== null}
	onOpenChange={(open) => {
		if (!open) {
			date = null;
			// A refusal answers one attempt, so it does not outlive the dialog it was shown in.
			refusal = null;
		}
	}}
>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>{label}</Dialog.Title>
			<Dialog.Description>
				No Class is taught this day. Every Slot on it is blocked, for every Class.
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/blockDay"
			use:enhance={() =>
				async ({ result, update }) => {
					// reset stays manual: a refused block must leave the dialog open with the note intact.
					await update({ invalidateAll: true, reset: false });
					if (result.type === 'success') {
						date = null;
						refusal = null;
					} else if (result.type === 'failure' && date)
						refusal = { date, message: failureReason(result, 'The block was refused.') };
				}}
		>
			{#if viewed}<input type="hidden" name="date" value={viewed} />{/if}
			<Input name="note" aria-label="{label}: note" placeholder="Note (optional)" />
			{#if error}
				<p role="alert" class="mt-1.5 text-xs text-destructive">{error}</p>
			{/if}
			<p class="mt-2 text-xs text-muted-foreground">
				{#if lessons > 0}
					{lessons} Lesson{lessons === 1 ? '' : 's'} on this day move{lessons === 1 ? 's' : ''} to each
					Class's next Available Slot, and every Lesson after them moves along.
				{:else}
					Nothing is scheduled this day, so nothing moves.
				{/if}
			</p>
			<Dialog.Footer>
				<Button type="submit">Block day</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
