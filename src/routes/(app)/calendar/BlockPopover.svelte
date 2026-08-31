<script lang="ts">
	import { enhance } from '$app/forms';
	import { failureReason } from '$lib/client/enhance';
	import * as Popover from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	// The note form for blocking one Slot, opened from its day menu and anchored over the
	// Slot's own tile, so the teacher can see which one they picked (issue #192). The note is
	// the whole point of a Blocked Slot — a hole in the week is otherwise unexplainable months
	// later — so it is required. A real popover rather than <details>: bits-ui closes on Escape
	// and returns focus. It stays its own file for the one rule the page must not lose: a note
	// the server rejects stays on screen with what was typed still in it, and the refusal is
	// named, rather than being discarded.
	let {
		action,
		fields,
		label,
		onOpenChange
	}: {
		action: string;
		fields: Record<string, string>;
		label: string;
		onOpenChange: (open: boolean) => void;
	} = $props();

	const id = $props.id();

	// The server's refusal — a note of spaces only passes the browser's required check but not
	// the seam's — named under the field, so the teacher can correct what they typed. The
	// component unmounts on every fresh pick, so the message never outlives the form it
	// belongs to.
	let error = $state<string | null>(null);
</script>

<!-- Open for exactly as long as the pick it serves: the page renders this only while a Slot
     is picked, so closing unmounts it and a fresh pick starts an empty note. -->
<Popover.Root open {onOpenChange}>
	<Popover.Trigger class="absolute top-1 right-1 size-0" aria-label={label} />
	<Popover.Content class="w-64 p-3" align="end">
		<form
			method="POST"
			{action}
			use:enhance={() =>
				async ({ formElement, result, update }) => {
					// reset stays manual: a failed action (the server rejects the note) must leave the
					// popover open with what was typed still in it, not silently discarded.
					await update({ invalidateAll: true, reset: false });
					if (result.type === 'success') {
						onOpenChange(false);
						formElement.reset();
					} else if (result.type === 'failure') {
						error = failureReason(result, 'The block was refused.');
					}
				}}
		>
			{#each Object.entries(fields) as [name, value] (name)}
				<input type="hidden" {name} {value} />
			{/each}
			<Label for={id}>{label}</Label>
			<Input {id} name="note" class="mt-2 h-7 text-xs" required placeholder="Why (required)" />
			<p class="mt-1.5 text-xs text-muted-foreground">
				The Class is not taught this Period; the school is open.
			</p>
			{#if error}
				<p role="alert" class="mt-1.5 text-xs text-destructive">{error}</p>
			{/if}
			<Button type="submit" size="sm" class="mt-3 w-full">Block</Button>
		</form>
	</Popover.Content>
</Popover.Root>
