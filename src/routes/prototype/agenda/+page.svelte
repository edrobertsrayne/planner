<!--
	PROTOTYPE — throwaway. Issue #68: what does the Agenda screen look like at real density?

	Three variants (`?variant=A|B|C`) that disagree about what the Agenda's unit is — the day, the
	period, or the next thing — and therefore about whether the horizon control exists at all.
	Two more axes on the bar: `?tone=tint|block` (the #67 tokens vs #67's louder fallback) and
	`?data=full|sparse|empty` for the sparse and empty windows the ticket asks to see.

	Runs on fixtures: no database, no login. See ./fixtures.ts.
-->
<script lang="ts">
	import { page } from '$app/state';
	import AgendaShell from './AgendaShell.svelte';
	import PrototypeSwitcher from './PrototypeSwitcher.svelte';
	import VariantA from './VariantA.svelte';
	import VariantB from './VariantB.svelte';
	import VariantC from './VariantC.svelte';
	import { agendaFixture, mondayOf, type DataSet } from './fixtures.js';
	import './tones.css';

	const VARIANTS = [
		{ key: 'A', name: 'The list' },
		{ key: 'B', name: 'The spine' },
		{ key: 'C', name: 'The briefing' }
	];

	// On a Saturday or Sunday the fixture fortnight starts on Monday and nothing is "today", which
	// hides the state every variant leans on hardest. Roll the weekend forward so Today is always
	// on screen — the fixtures are a fortnight of school days, not a calendar.
	const today = mondayOf(new Date().toISOString().slice(0, 10));

	const param = (name: string, allowed: string[], fallback: string) => {
		const v = page.url.searchParams.get(name);
		return v && allowed.includes(v) ? v : fallback;
	};

	const key = $derived(param('variant', ['A', 'B', 'C'], 'A'));
	const toneStrength = $derived(param('tone', ['tint', 'block'], 'tint'));
	const dataSet = $derived(param('data', ['full', 'sparse', 'empty'], 'full') as DataSet);

	const rows = $derived(agendaFixture(today, dataSet));

	// Shared across variants so flipping between them doesn't silently reset the window — A and B
	// each own a control for it, C deliberately has none.
	let horizon = $state(7);
</script>

<svelte:head><title>Prototype — Agenda layout</title></svelte:head>

<div data-tone={toneStrength}>
	<AgendaShell>
		{#if key === 'A'}
			<VariantA {rows} {today} bind:horizon />
		{:else if key === 'B'}
			<VariantB {rows} {today} bind:horizon />
		{:else}
			<VariantC {rows} {today} />
		{/if}
	</AgendaShell>
</div>

<PrototypeSwitcher variants={VARIANTS} current={key} tone={toneStrength} data={dataSet} />
