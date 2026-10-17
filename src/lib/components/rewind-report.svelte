<script lang="ts">
	import type { WriteReport } from '$lib/server/planner';
	import PlacementsMovedAlert from './placements-moved-alert.svelte';

	// A write's report in one voice, wherever a write can produce one: the Placements it pushed off
	// their anchor. No report, nothing shown. When a write moved no Placement and the caller gave
	// `none`, that plain statement stands in, styled by `class` — silence would read as an
	// unapplied write. The wording stays each write's own.
	let {
		report,
		none,
		class: className = ''
	}: { report: WriteReport | null | undefined; none?: string; class?: string } = $props();
</script>

{#if report}
	{#if report.placementsMoved.length === 0 && none}
		<p class={className} role="status">{none}</p>
	{/if}
	<PlacementsMovedAlert placementsMoved={report.placementsMoved} />
{/if}
