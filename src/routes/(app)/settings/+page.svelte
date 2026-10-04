<!--
	PROTOTYPE ONLY — issue #314 "How should Settings, Login and Setup lay out at each size?" Four
	Settings variants, switchable via `?view=A|B|C|D`, inside the chosen app shell (issue #305), at
	`max-w-6xl` with no description line (issue #316). The real load runs: the API key and the
	Backup size are real. Every write is a stub that changes nothing.
-->
<script lang="ts">
	import { page } from '$app/state';
	import PrototypeSwitcher from '$lib/components/prototype-switcher.svelte';
	import SettingsA from './prototype/SettingsA.svelte';
	import SettingsB from './prototype/SettingsB.svelte';
	import SettingsC from './prototype/SettingsC.svelte';
	import SettingsD from './prototype/SettingsD.svelte';

	let { data } = $props();

	const VARIANTS = [
		{ key: 'A', label: 'Cards in one column' },
		{ key: 'B', label: 'Title beside the controls' },
		{ key: 'C', label: 'Cards fill the width' },
		{ key: 'D', label: 'One section at a time' }
	];
	const variant = $derived(page.url.searchParams.get('view') ?? 'A');
</script>

<svelte:head><title>Settings (prototype {variant})</title></svelte:head>

{#if variant === 'B'}
	<SettingsB {data} />
{:else if variant === 'C'}
	<SettingsC {data} />
{:else if variant === 'D'}
	<SettingsD {data} />
{:else}
	<SettingsA {data} />
{/if}

<PrototypeSwitcher variants={VARIANTS} current={variant} paramName="view" />
