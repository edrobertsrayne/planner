<script lang="ts">
	import type { WriteReport } from '$lib/server/planner';
	import AtRiskAlert from './at-risk-alert.svelte';
	import PlacementsMovedAlert from './placements-moved-alert.svelte';

	// A Rewind's report in one voice (ADR-0007), wherever a write can produce one: the noted
	// Sessions it put at risk, and the Placements it pushed off their anchor. No report, nothing
	// shown. When a write put no Session at risk and the caller gave `none`, that plain statement
	// stands in, styled by `class` — silence would read as an unapplied write. The wording stays
	// each write's own.
	let {
		report,
		none,
		class: className = ''
	}: { report: WriteReport | null | undefined; none?: string; class?: string } = $props();
</script>

{#if report}
	{#if report.atRisk.length > 0}
		<AtRiskAlert atRisk={report.atRisk} />
	{:else if none}
		<p class={className} role="status">{none}</p>
	{/if}
	<PlacementsMovedAlert placementsMoved={report.placementsMoved} />
{/if}
