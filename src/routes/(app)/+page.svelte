<!--
	PROTOTYPE ONLY — issue #310 "How should the Agenda read on a phone and on a laptop, and what
	replaces the Tag filter dropdown?" Four variants, switchable via `?variant=A|B|C|D`, on fake data
	held in memory. Ready ticks and Session notes are local and lost on reload. The app shell is the
	one chosen in issue #305 (sidebar). A row opens a stand-in for the Session panel (issue #311).
-->
<script lang="ts">
	import { page } from '$app/state';
	import PrototypeSwitcher from '$lib/components/prototype-switcher.svelte';
	import AgendaA from './prototype-agenda/AgendaA.svelte';
	import AgendaB from './prototype-agenda/AgendaB.svelte';
	import AgendaC from './prototype-agenda/AgendaC.svelte';
	import AgendaD from './prototype-agenda/AgendaD.svelte';
	import SessionStub from './prototype-agenda/SessionStub.svelte';

	const VARIANTS = [
		{ key: 'A', label: 'One column, Tag chips' },
		{ key: 'B', label: 'Week board, day strip' },
		{ key: 'C', label: 'Filter rail and table' },
		{ key: 'D', label: 'Today first, click a Tag' }
	];
	const variant = $derived(page.url.searchParams.get('variant') ?? 'A');
	const Variant = $derived(
		({ A: AgendaA, B: AgendaB, C: AgendaC, D: AgendaD } as Record<string, typeof AgendaA>)[
			variant
		] ?? AgendaA
	);
</script>

<svelte:head><title>Agenda (prototype {variant})</title></svelte:head>

<Variant />
<SessionStub />

<PrototypeSwitcher variants={VARIANTS} current={variant} />
