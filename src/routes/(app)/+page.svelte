<!--
	PROTOTYPE ONLY — issue #311 "How should the Session panel work on a phone and on a laptop?"
	Four variants, switchable via `?panel=A|B|C|D`, on the chosen Agenda (issue #310, variant A)
	inside the chosen app shell (issue #305). Fake data held in memory: notes, Continuations and
	Placements are lost on reload. Readiness is ticked on the Agenda row; the Session shows it
	read-only.
-->
<script lang="ts">
	import { page } from '$app/state';
	import PrototypeSwitcher from '$lib/components/prototype-switcher.svelte';
	import AgendaA from './prototype-agenda/AgendaA.svelte';
	import { rowByKey, type Row } from './prototype-agenda/store.svelte';
	import PageD from './prototype-session/PageD.svelte';
	import PanelA from './prototype-session/PanelA.svelte';
	import RowB from './prototype-session/RowB.svelte';
	import SheetC from './prototype-session/SheetC.svelte';
	import { close, detailOf, openDetail } from './prototype-session/store.svelte';

	const VARIANTS = [
		{ key: 'A', label: 'Side panel' },
		{ key: 'B', label: 'Opens in the row' },
		{ key: 'C', label: 'Sheet with tabs' },
		{ key: 'D', label: 'Session page' }
	];
	const variant = $derived(page.url.searchParams.get('panel') ?? 'A');
	const d = $derived(openDetail());
</script>

{#snippet inRow(r: Row)}
	{@const rd = detailOf(rowByKey(r.key))}
	{#if rd}<RowB d={rd} />{/if}
{/snippet}

<svelte:head><title>Agenda (Session prototype {variant})</title></svelte:head>
<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && variant !== 'C') close();
	}}
/>

{#if variant === 'A'}
	<div class="lg:flex lg:items-start">
		<div class="min-w-0 flex-1"><AgendaA /></div>
		{#if d}<PanelA {d} />{/if}
	</div>
{:else if variant === 'B'}
	<AgendaA expand={inRow} />
{:else if variant === 'C'}
	<AgendaA />
	<SheetC {d} />
{:else if d}
	<PageD {d} />
{:else}
	<AgendaA />
{/if}

<PrototypeSwitcher variants={VARIANTS} current={variant} paramName="panel" />
