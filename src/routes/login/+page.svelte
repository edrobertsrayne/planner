<!-- PROTOTYPE (issue #56) — three variants of /login on this route, switchable via ?variant=.
     Throwaway: the losers and the switcher come out once a direction is picked. -->
<script lang="ts">
	import { page } from '$app/state';
	import PrototypeSwitcher from '$lib/prototype/PrototypeSwitcher.svelte';
	import RuledLogin from '$lib/prototype/signed-out/ruled/Login.svelte';
	import FortnightLogin from '$lib/prototype/signed-out/fortnight/Login.svelte';
	import ToneLogin from '$lib/prototype/signed-out/tone/Login.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	const VARIANTS = [
		{ key: 'A', name: 'Ruled — exercise book' },
		{ key: 'B', name: 'Fortnight — the grid' },
		{ key: 'C', name: 'Tone — split colour field' }
	];
	const variant = $derived(page.url.searchParams.get('variant') ?? 'A');
</script>

{#if variant === 'B'}
	<FortnightLogin {form} />
{:else if variant === 'C'}
	<ToneLogin {form} />
{:else}
	<RuledLogin {form} />
{/if}

<PrototypeSwitcher variants={VARIANTS} />
