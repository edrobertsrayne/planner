<!--
	PROTOTYPE ONLY — issue #314 "How should Settings, Login and Setup lay out at each size?" Three
	Setup variants, switchable via `?view=A|B|C`, narrow (`max-w-sm`, issue #316). The letters match
	the Login prototype, so `?view=` shows one treatment on both. Every write is a stub. The guard is
	off in dev, so this page opens although an account exists.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { Toaster } from '$lib/components/ui/sonner';
	import PrototypeSwitcher from '$lib/components/prototype-switcher.svelte';
	import SetupA from './prototype/SetupA.svelte';
	import SetupB from './prototype/SetupB.svelte';
	import SetupC from './prototype/SetupC.svelte';

	const VARIANTS = [
		{ key: 'A', label: 'Two cards, kept' },
		{ key: 'B', label: 'One card, two tabs; flush on a phone' },
		{ key: 'C', label: 'Restore behind a link; flush on a phone' }
	];
	const variant = $derived(page.url.searchParams.get('view') ?? 'A');
</script>

<svelte:head><title>Set up Planner (prototype {variant})</title></svelte:head>

{#if variant === 'B'}
	<SetupB />
{:else if variant === 'C'}
	<SetupC />
{:else}
	<SetupA />
{/if}

<Toaster richColors />
<PrototypeSwitcher variants={VARIANTS} current={variant} paramName="view" />
