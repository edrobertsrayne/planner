<!--
	PROTOTYPE — throwaway. Class page variant E — "workbench + both weeks, spacious".
	C's layout and B's density, but refusing B's trade: Week A and Week B both on the bench, stacked
	down the column. Same cell size and same orientation as D — the only difference is whether the
	fortnight is whole. Measured at 1118×1100 the whole thing lands around 780px, so on a laptop it
	fits without scrolling; the toggle D pays for buys back only a few hundred pixels.
-->
<script lang="ts">
	import Workbench from './Workbench.svelte';
	import SlotGridBothWeeks from './SlotGridBothWeeks.svelte';
</script>

<Workbench note="The whole fortnight, nothing hidden, and it still fits a laptop screen.">
	{#snippet grid()}
		<SlotGridBothWeeks />
	{/snippet}
</Workbench>
