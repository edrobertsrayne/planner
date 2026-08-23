<!--
	PROTOTYPE — throwaway. The answer to the correctness bug #69 names.

	`calendar/+page.svelte:263` uses `<details>`/`<summary>` as a popover: an absolutely positioned
	form panel with no outside-click dismiss, no Escape, no focus return, and no z-index discipline.
	This is the same shape built on the registry's `popover` — which was already on disk, so #65's
	"decide what you need when you need it" holds. Every variant uses this one component, so the
	control is not one of the things under test.

	Two scopes. A Blocked Slot may carry free text and the note is the whole point of it — a hole in
	the week is otherwise unexplainable months later — so its note is required. A Blocked Day
	carries no cause at all in CONTEXT.md, though today's code offers an optional note; kept
	optional here rather than resolving that divergence inside a layout ticket.
-->
<script lang="ts">
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { Snippet } from 'svelte';

	let {
		scope,
		subject,
		triggerClass,
		trigger
	}: { scope: 'slot' | 'day'; subject: string; triggerClass?: string; trigger: Snippet } = $props();

	let open = $state(false);
	let note = $state('');

	const id = $props.id();
</script>

<Popover.Root bind:open>
	<Popover.Trigger class={triggerClass}>{@render trigger()}</Popover.Trigger>
	<Popover.Content class="w-64 p-3" align="end" sideOffset={4}>
		<form
			class="grid gap-2"
			onsubmit={(e) => {
				e.preventDefault();
				open = false;
				note = '';
			}}
		>
			<Label for={id} class="text-xs">Block {subject}</Label>
			<Input
				{id}
				bind:value={note}
				class="h-7"
				required={scope === 'slot'}
				placeholder={scope === 'slot' ? 'Why (required)' : 'Note (optional)'}
			/>
			<p class="text-xs text-muted-foreground">
				{scope === 'slot'
					? 'The Class is not taught this Period; the school is open.'
					: 'No Class is taught on this date. Every Slot on it is blocked.'}
			</p>
			<Button type="submit" size="sm" class="h-7">Block</Button>
		</form>
	</Popover.Content>
</Popover.Root>
