<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { formatWeekday } from '$lib/date';

	// PROTOTYPE: the form for blocking a whole day from the Agenda. Unlike a Blocked Slot, the note
	// is optional (a Blocked Day records no cause: INSET, snow and illness all read the same). The
	// page fakes the write until the Agenda gets its own blockDay action.
	let {
		date = $bindable(null),
		lessons,
		onblock
	}: {
		date: string | null;
		lessons: number;
		onblock: (date: string, note: string | null) => void;
	} = $props();

	let note = $state('');
	const label = $derived(date ? `Block ${formatWeekday(date)}` : '');
</script>

<Dialog.Root
	open={date !== null}
	onOpenChange={(open) => {
		if (!open) {
			date = null;
			note = '';
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
			onsubmit={(e) => {
				e.preventDefault();
				if (date) onblock(date, note.trim() || null);
				date = null;
				note = '';
			}}
		>
			<Input bind:value={note} aria-label="{label}: note" placeholder="Note (optional)" />
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
