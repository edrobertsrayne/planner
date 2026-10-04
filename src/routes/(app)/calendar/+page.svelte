<!--
	PROTOTYPE ONLY — issue #312 "How should the Calendar read on a phone and a tablet?"
	Four variants, switchable via `?view=A|B|C|D`, inside the chosen app shell (issue #305), at
	`max-w-6xl` with no description line (issue #316). Fake data held in memory, from the Agenda
	prototype, so a tile opens the Session page chosen in issue #311. Blocked Days and Blocked Slots
	are lost on reload. The real load still runs; its data is ignored.
-->
<script lang="ts">
	import { page } from '$app/state';
	import PrototypeSwitcher from '$lib/components/prototype-switcher.svelte';
	import CalendarA from './prototype/CalendarA.svelte';
	import CalendarB from './prototype/CalendarB.svelte';
	import CalendarC from './prototype/CalendarC.svelte';
	import CalendarD from './prototype/CalendarD.svelte';

	const VARIANTS = [
		{ key: 'A', label: 'One day at a time' },
		{ key: 'B', label: 'The week as a list' },
		{ key: 'C', label: 'The grid at every size' },
		{ key: 'D', label: 'Swipe through the days' }
	];
	const variant = $derived(page.url.searchParams.get('view') ?? 'A');
</script>

<svelte:head><title>Calendar (prototype {variant})</title></svelte:head>

{#if variant === 'A'}
	<CalendarA />
{:else if variant === 'B'}
	<CalendarB />
{:else if variant === 'C'}
	<CalendarC />
{:else}
	<CalendarD />
{/if}

<PrototypeSwitcher variants={VARIANTS} current={variant} paramName="view" />

<style>
	:global(.hatched) {
		background-image: repeating-linear-gradient(
			135deg,
			color-mix(in oklab, var(--muted-foreground) 14%, transparent) 0 5px,
			transparent 5px 10px
		);
	}
	:global(.day-panel-holiday) {
		background-color: color-mix(in oklab, var(--muted-foreground) 16%, transparent);
	}
</style>
