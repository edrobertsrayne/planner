<!-- PROTOTYPE (issue #56) — two variants of /setup on this route, switchable via ?variant=. -->
<script lang="ts">
	import { page } from '$app/state';
	import PrototypeSwitcher from '$lib/prototype/PrototypeSwitcher.svelte';
	import CardSetup from '$lib/prototype/signed-out/card/Setup.svelte';
	import BareSetup from '$lib/prototype/signed-out/bare/Setup.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	const VARIANTS = [
		{ key: 'A', name: 'Card on muted (signup-03)' },
		{ key: 'B', name: 'Bare on background (signup-05)' }
	];
	const variant = $derived(page.url.searchParams.get('variant') ?? 'A');
</script>

{#if variant === 'B'}
	<BareSetup {form} />
{:else}
	<CardSetup {form} />
{/if}

<PrototypeSwitcher variants={VARIANTS} />
