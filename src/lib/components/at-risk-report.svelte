<script lang="ts">
	import type { AtRiskSession } from '$lib/server/planner';
	import AtRiskAlert from './at-risk-alert.svelte';

	// A Rewind's report in one voice (ADR-0007): the alert when a write put Sessions at risk,
	// and — because silence would read as an unapplied write — the caller's own plain statement
	// when it put none. The year save and the Blocked Day writes share this; the wording of the
	// empty case stays each write's own.
	let {
		atRisk,
		none,
		class: className = ''
	}: { atRisk: AtRiskSession[]; none: string; class?: string } = $props();
</script>

{#if atRisk.length > 0}
	<div class={className}>
		<AtRiskAlert {atRisk} />
	</div>
{:else}
	<p class={className} role="status">{none}</p>
{/if}
