<!--
	PROTOTYPE — throwaway route. Three structurally different takes on the derived schedule (issue
	#61): whether Agenda and Calendar are one screen or two, and what either shape looks like on
	rhea/shadcn. Switchable via ?variant=A|B|C. See PrototypeSwitcher for the floating bar.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import VariantA from './VariantA.svelte';
	import VariantB from './VariantB.svelte';
	import VariantC from './VariantC.svelte';
	import PrototypeSwitcher from './PrototypeSwitcher.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const VARIANTS = [
		{ key: 'A', name: 'Two surfaces, restyled' },
		{ key: 'B', name: 'The week is the app' },
		{ key: 'C', name: 'One destination, two views' }
	];

	const variant = $derived(page.url.searchParams.get('variant') ?? 'A');

	function onNav(weekCommencing: string) {
		const url = new URL(page.url);
		url.searchParams.set('week', weekCommencing);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- prototype-only route
		goto(url, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true });
	}
</script>

<div class="h-screen">
	{#if variant === 'B'}
		<VariantB {data} {onNav} />
	{:else if variant === 'C'}
		<VariantC {data} {onNav} />
	{:else}
		<VariantA {data} {onNav} />
	{/if}
</div>

<PrototypeSwitcher variants={VARIANTS} current={variant} />
