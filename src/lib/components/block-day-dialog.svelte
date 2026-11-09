<script lang="ts">
	import { enhance } from '$app/forms';
	import { failureReason } from '$lib/client/enhance';
	import * as Dialog from '$lib/ui/dialog';
	import { Button, Input } from '$lib/ui';
	import AbsentField from '$lib/components/absent-field.svelte';
	import { formatWeekday } from '$lib/date';

	// The form for blocking a whole day, opened from an Agenda day heading. Mounted once and opened
	// through the bound date, as BlockSlotDialog is: `date` null is closed. Unlike a Blocked Slot a
	// Blocked Day's note is optional. The one cause recorded is whether it is an Absence (ADR-0030).
	// `lessons` is the page's count of the day's rows, so the dialog can say how much moves.
	let { date = $bindable(null), lessons }: { date: string | null; lessons: number } = $props();

	const label = $derived(date ? `Block ${formatWeekday(date)}` : '');

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
			{#if date}<input type="hidden" name="date" value={date} />{/if}
			<AbsentField hint="Each Class this day takes will offer a Set cover button." />
			<Input class="mt-3" name="note" aria-label="{label}: note" placeholder="Note (optional)" />
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
