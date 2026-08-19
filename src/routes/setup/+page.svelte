<!-- PROTOTYPE (issue #56) — three variants of /setup on this route, switchable via ?variant=. -->
<script lang="ts">
	import { page } from '$app/state';
	import PrototypeSwitcher from '$lib/prototype/PrototypeSwitcher.svelte';
	import RuledSetup from '$lib/prototype/signed-out/ruled/Setup.svelte';
	import FortnightSetup from '$lib/prototype/signed-out/fortnight/Setup.svelte';
	import ToneSetup from '$lib/prototype/signed-out/tone/Setup.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	const VARIANTS = [
		{ key: 'A', name: 'Ruled — one screen' },
		{ key: 'B', name: 'Fortnight — stepped' },
		{ key: 'C', name: 'Tone — one screen' }
	];
	const variant = $derived(page.url.searchParams.get('variant') ?? 'A');
</script>

{#if variant === 'B'}
	<FortnightSetup {form} />
{:else if variant === 'C'}
	<ToneSetup {form} />
{:else}
	<RuledSetup {form} />
{/if}

<PrototypeSwitcher variants={VARIANTS} />
