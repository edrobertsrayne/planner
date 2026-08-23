<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Snippet } from 'svelte';
	import * as Popover from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	// The block control — a Blocked Slot or a Blocked Day, entered through the grid it will drain
	// (issue #90). A real popover rather than <details>: bits-ui closes on Escape and returns focus
	// to the trigger. A Blocked Slot may carry free text and the note is the whole point of it — a
	// hole in the week is otherwise unexplainable months later — so its note is required. A Blocked
	// Day carries no cause at all in CONTEXT.md; kept optional here rather than resolving that
	// divergence inside a layout ticket.
	let {
		action,
		fields,
		label,
		noteRequired,
		contentClass,
		triggerClass,
		triggerLabel,
		trigger
	}: {
		action: string;
		fields: Record<string, string>;
		label: string;
		noteRequired: boolean;
		contentClass?: string;
		triggerClass?: string;
		triggerLabel?: string;
		trigger: Snippet;
	} = $props();

	let open = $state(false);
	const id = $props.id();
</script>

<Popover.Root bind:open>
	<Popover.Trigger class={triggerClass} aria-label={triggerLabel}>
		{@render trigger()}
	</Popover.Trigger>
	<Popover.Content class={contentClass} align="end">
		<form
			method="POST"
			{action}
			use:enhance={() =>
				async ({ formElement, result, update }) => {
					// reset stays manual: a failed action (the server rejects the note) must leave the
					// popover open with what was typed still in it, not silently discarded.
					await update({ invalidateAll: true, reset: false });
					if (result.type === 'success') {
						open = false;
						formElement.reset();
					}
				}}
		>
			{#each Object.entries(fields) as [name, value] (name)}
				<input type="hidden" {name} {value} />
			{/each}
			<Label for={id}>{label}</Label>
			<Input
				{id}
				name="note"
				class="mt-2 h-7 text-xs"
				required={noteRequired}
				placeholder={noteRequired ? 'Why (required)' : 'Note (optional)'}
			/>
			<p class="mt-1.5 text-xs text-muted-foreground">
				{noteRequired
					? 'The Class is not taught this Period; the school is open.'
					: 'No Class is taught on this date. Every Slot on it is blocked.'}
			</p>
			<Button type="submit" size="sm" class="mt-3 w-full">Block</Button>
		</form>
	</Popover.Content>
</Popover.Root>
