<script lang="ts">
	// PROTOTYPE — throwaway route answering issue #6: what do the agenda and week
	// views actually show? Three structurally different variants on one route,
	// switchable via ?variant= and the floating bar. No database, no persistence,
	// no auth — fixtures only. Delete this directory when #6 closes.
	import { page } from '$app/state';
	import PrototypeSwitcher from './PrototypeSwitcher.svelte';
	import VariantA from './VariantA.svelte';
	import VariantB from './VariantB.svelte';
	import VariantC from './VariantC.svelte';
	import VariantD from './VariantD.svelte';

	const variants = [
		{ key: 'D', name: 'THE ANSWER — Agenda / Calendar / Classes' },
		{ key: 'A', name: 'Two surfaces — agenda + week' },
		{ key: 'B', name: 'The week is the app' },
		{ key: 'C', name: 'Class lanes' }
	];

	const variant = $derived(page.url.searchParams.get('variant') ?? 'D');
</script>

<svelte:head><title>PROTOTYPE — agenda and week views (#6)</title></svelte:head>

{#if variant === 'A'}
	<VariantA />
{:else if variant === 'B'}
	<VariantB />
{:else if variant === 'C'}
	<VariantC />
{:else}
	<VariantD />
{/if}

<PrototypeSwitcher {variants} />
