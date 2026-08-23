<!--
	PROTOTYPE — throwaway. Issue #69: what does the Calendar (Teaching Week) grid look like at real
	density?

	Three variants (`?variant=A|B|C`) that disagree about what a grid cell *is* — a card, a ruled
	table cell, or a row in a day's stack — and therefore about how much of a fortnight fits on a
	screen. Two more axes on the bar: `?class=fill|chip|stripe` for how much of the #67 tone a cell
	wears, and `?weeks=one|both` for whether both halves of the Teaching Week are shown at once.

	Runs on fixtures: no database, no login. See ./fixtures.ts.
-->
<script lang="ts">
	import { page } from '$app/state';
	import CalendarShell from './CalendarShell.svelte';
	import PageHeader from './PageHeader.svelte';
	import PrototypeSwitcher from './PrototypeSwitcher.svelte';
	import WeekRibbon from './WeekRibbon.svelte';
	import VariantA from './VariantA.svelte';
	import VariantB from './VariantB.svelte';
	import VariantC from './VariantC.svelte';
	import { fortnight, mondayOf, ribbon } from './fixtures.js';
	import type { ClassCue } from './tone.js';
	import './blocked.css';

	const VARIANTS = [
		{ key: 'A', name: 'The tiles' },
		{ key: 'B', name: 'The timetable' },
		{ key: 'C', name: 'The day stacks' }
	];

	// The fixtures are a fortnight of school days, so a weekend rolls forward to the next Monday
	// rather than rendering a week nothing sits in.
	const thisMonday = mondayOf(new Date().toISOString().slice(0, 10));

	const param = (name: string, allowed: string[], fallback: string) => {
		const v = page.url.searchParams.get(name);
		return v && allowed.includes(v) ? v : fallback;
	};

	const key = $derived(param('variant', ['A', 'B', 'C'], 'A'));
	const cue = $derived(param('class', ['fill', 'chip', 'stripe'], 'fill') as ClassCue);
	const weeksMode = $derived(param('weeks', ['one', 'both'], 'one') as 'one' | 'both');

	// Week navigation is not what this ticket asks about, so the ribbon is shared and its selection
	// only moves which Monday the grid is labelled with — the fixture week itself doesn't change.
	let selected = $state(thisMonday);
	const weeks = $derived(ribbon(thisMonday));
	const shown = $derived(fortnight(selected, weeksMode));
	const current = $derived(weeks.find((w) => w.weekCommencing === selected));
</script>

<svelte:head><title>Prototype — Calendar grid</title></svelte:head>

<CalendarShell>
	<div class="px-6 py-4">
		<PageHeader
			title="Calendar"
			description={weeksMode === 'both'
				? 'The Teaching Week, both halves.'
				: `Teaching Week ${current?.letter ?? 'A'}.`}
		>
			{#snippet actions()}
				<WeekRibbon {weeks} {selected} onselect={(w) => (selected = w)} />
			{/snippet}
		</PageHeader>

		{#if key === 'A'}
			<VariantA weeks={shown} {cue} />
		{:else if key === 'B'}
			<VariantB weeks={shown} {cue} />
		{:else}
			<VariantC weeks={shown} {cue} />
		{/if}
	</div>
</CalendarShell>

<PrototypeSwitcher variants={VARIANTS} current={key} {cue} weeks={weeksMode} />
