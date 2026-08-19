<!-- PROTOTYPE (issue #56) — two variants of /login on this route, switchable via ?variant=.
     Both are built only from shadcn-svelte components, on the shadcn-svelte sign-up blocks
     signup-03 (card) and signup-05 (bare). -->
<script lang="ts">
	import { page } from '$app/state';
	import PrototypeSwitcher from '$lib/prototype/PrototypeSwitcher.svelte';
	import CardLogin from '$lib/prototype/signed-out/card/Login.svelte';
	import BareLogin from '$lib/prototype/signed-out/bare/Login.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	const VARIANTS = [
		{ key: 'A', name: 'Card on muted (signup-03)' },
		{ key: 'B', name: 'Bare on background (signup-05)' }
	];
	const variant = $derived(page.url.searchParams.get('variant') ?? 'A');
</script>

{#if variant === 'B'}
	<BareLogin {form} />
{:else}
	<CardLogin {form} />
{/if}

<PrototypeSwitcher variants={VARIANTS} />
