<!--
	PROTOTYPE — throwaway route. Three structurally different answers to "where does a Session
	open?" (issue #62), each rendered against the real Agenda list and Teaching Week grid at their
	settled density so the trade-off is honest.

	  A — Persistent aside      store-driven, schedule squeezed beside it
	  B — Its own destination   URL-driven, replaces the schedule, wide two-column hierarchy
	  C — Sheet over the top    URL-driven, overlays the schedule at full width

	Switchable via ?variant=A|B|C. B and C also carry ?session=<class>~<date>~<period> — reload
	the page with one open to feel the difference from A.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { Occasion } from '$lib/client/session-panel.svelte';
	import VariantA from './VariantA.svelte';
	import VariantB from './VariantB.svelte';
	import VariantC from './VariantC.svelte';
	import PrototypeSwitcher from './PrototypeSwitcher.svelte';
	import { PARAM, decodeOccasion, encodeOccasion } from './occasion';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const VARIANTS = [
		{ key: 'A', name: 'Persistent aside' },
		{ key: 'B', name: 'Its own destination' },
		{ key: 'C', name: 'Sheet over the top' }
	];

	const variant = $derived(page.url.searchParams.get('variant') ?? 'A');
	const selected = $derived(decodeOccasion(page.url.searchParams.get(PARAM)));

	function navigate(mutate: (url: URL) => void, opts: { push?: boolean } = {}) {
		const url = new URL(page.url);
		mutate(url);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- prototype-only route
		goto(url, {
			replaceState: !opts.push,
			noScroll: true,
			keepFocus: true,
			invalidateAll: true
		});
	}

	function onNav(weekCommencing: string) {
		navigate((url) => url.searchParams.set('week', weekCommencing));
	}

	// Pushed, not replaced: browser Back closing a Session is half of what B and C are claiming.
	function onSelect(occasion: Occasion | null) {
		navigate(
			(url) => {
				if (occasion) url.searchParams.set(PARAM, encodeOccasion(occasion));
				else url.searchParams.delete(PARAM);
			},
			{ push: true }
		);
	}
</script>

<div class="h-screen">
	{#if variant === 'B'}
		<VariantB {data} {onNav} {selected} {onSelect} />
	{:else if variant === 'C'}
		<VariantC {data} {onNav} {selected} {onSelect} />
	{:else}
		<VariantA {data} {onNav} />
	{/if}
</div>

<PrototypeSwitcher variants={VARIANTS} current={variant} />
