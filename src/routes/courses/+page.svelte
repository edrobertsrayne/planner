<script lang="ts">
	import { page } from '$app/state';
	import VariantA from './VariantA.svelte';
	import VariantB from './VariantB.svelte';
	import VariantC from './VariantC.svelte';
	import PrototypeSwitcher from './PrototypeSwitcher.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const variants = [
		{ key: 'A', name: 'Dialog, fixed' },
		{ key: 'B', name: 'Its own space' },
		{ key: 'C', name: 'Inline, no modal' }
	];
	const variant = $derived(page.url.searchParams.get('variant') ?? 'A');
</script>

<svelte:head><title>Courses</title></svelte:head>

{#if variant === 'B'}
	<VariantB {data} {form} />
{:else if variant === 'C'}
	<VariantC {data} {form} />
{:else}
	<VariantA {data} {form} />
{/if}

<PrototypeSwitcher {variants} current={variant} />
