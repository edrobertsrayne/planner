<!--
	PROTOTYPE — throwaway. Class page variant D — "workbench + B's grid, one week at a time".
	C's layout, B's grid dropped straight onto the bench: Periods down, days across, cells wide
	enough for a full Class label, one Teaching Week behind a Week A / Week B toggle. The rail and
	the whole grid sit above the fold together, and nothing scrolls. The bill is the toggle: the
	fortnight is never on screen whole, so a Slot that exists in Week A but not Week B is a thing
	you have to flip to notice.
-->
<script lang="ts">
	import Workbench from './Workbench.svelte';
	import SlotGridUnified from './SlotGridUnified.svelte';
</script>

<Workbench
	note="One Teaching Week at a time — flip the toggle to see the other half of the fortnight."
>
	{#snippet grid()}
		<SlotGridUnified />
	{/snippet}
</Workbench>
