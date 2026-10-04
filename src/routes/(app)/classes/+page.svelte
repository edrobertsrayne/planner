<!--
	PROTOTYPE ONLY — issue #313 "How should the Classes screen and the Class page lay out at each
	size?" Four variants, switchable via `?view=A|B|C|D`, inside the chosen app shell (issue #305),
	at `max-w-6xl` with no description line (issue #316). `?class=<id>` opens the Class page on this
	route, as the Courses prototype did. Fake data held in memory, from the Planning and Agenda
	prototypes, so Last taught and the next Sessions open the Session page chosen in issue #311.
	Every write is local and lost on reload. The real load still runs; its data is ignored.
-->
<script lang="ts">
	import { page } from '$app/state';
	import PrototypeSwitcher from '$lib/components/prototype-switcher.svelte';
	import ClassesA from './prototype/ClassesA.svelte';
	import ClassesB from './prototype/ClassesB.svelte';
	import ClassesC from './prototype/ClassesC.svelte';
	import ClassesD from './prototype/ClassesD.svelte';

	const VARIANTS = [
		{ key: 'A', label: 'The bench, kept' },
		{ key: 'B', label: 'A list, both weeks side by side' },
		{ key: 'C', label: 'Overview and Timetable tabs' },
		{ key: 'D', label: 'One week at a time, by Course' }
	];
	const variant = $derived(page.url.searchParams.get('view') ?? 'A');
</script>

<svelte:head><title>Classes (prototype {variant})</title></svelte:head>

{#if variant === 'A'}
	<ClassesA />
{:else if variant === 'B'}
	<ClassesB />
{:else if variant === 'C'}
	<ClassesC />
{:else}
	<ClassesD />
{/if}

<PrototypeSwitcher variants={VARIANTS} current={variant} paramName="view" />
