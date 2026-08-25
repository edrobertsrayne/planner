<script lang="ts">
	import { enhance } from '$app/forms';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { Button } from '$lib/components/ui/button';

	// Move one row up or down within its order — a Topic's Lessons, a Lesson's Links. Each
	// direction is its own POST to the same action, since a button outside a form cannot submit
	// one; that pair is the whole reason this is a component rather than two ordinary buttons
	// written out at each call site.
	//
	// Off either end is disabled rather than a no-op the server absorbs — the seam refuses the
	// move anyway (issue #33), but `first` and `last` are what the reader sees.
	let {
		action,
		fields,
		label,
		first,
		last
	}: {
		action: string;
		// The row this move is about, besides `direction`, as hidden inputs.
		fields: Record<string, string>;
		// What the row is, for the two aria-labels: "Move {label} up".
		label: string;
		first: boolean;
		last: boolean;
	} = $props();
</script>

{#each [{ direction: 'up', disabled: first }, { direction: 'down', disabled: last }] as move (move.direction)}
	<form method="POST" {action} use:enhance>
		{#each Object.entries(fields) as [name, value] (name)}
			<input type="hidden" {name} {value} />
		{/each}
		<input type="hidden" name="direction" value={move.direction} />
		<Button
			type="submit"
			variant="ghost"
			size="icon-sm"
			disabled={move.disabled}
			aria-label="Move {label} {move.direction}"
		>
			{#if move.direction === 'up'}
				<ChevronUpIcon class="size-3.5" />
			{:else}
				<ChevronDownIcon class="size-3.5" />
			{/if}
		</Button>
	</form>
{/each}
