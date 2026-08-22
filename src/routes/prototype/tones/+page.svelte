<!--
	PROTOTYPE — throwaway. Issue #67: which OKLCH curve do the eight Class tones use?

	Three curves (`?variant=A|B|C`), switchable from the floating bar. Unlike the other prototypes
	the variants are not layouts — the layout is the constant here, and the curve is what changes,
	so every surface is rendered identically under each curve. Both themes are on screen at once
	because the whole question is whether one curve can carry both.

	No database, no login — fixtures only. See ./fixtures.ts and ./curves.ts.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { VARIANTS, TONES } from './curves';
	import ToneSheet from './ToneSheet.svelte';
	import PrototypeSwitcher from './PrototypeSwitcher.svelte';

	const key = $derived(
		VARIANTS.some((v) => v.key === page.url.searchParams.get('variant'))
			? page.url.searchParams.get('variant')!
			: 'A'
	);
	const variant = $derived(VARIANTS.find((v) => v.key === key)!);

	/*
		Hue spacing is a property of the hue set, not of any curve — no curve rescues two hues that
		sit 20° apart. Printed here because #59 fixed the eight hues and this ticket is the one
		allowed to override them.
	*/
	const byHue = [...TONES].sort((a, b) => a.h - b.h);
	const gaps = byHue
		.map((t, i) => {
			const next = byHue[(i + 1) % byHue.length];
			return { pair: `${t.name}–${next.name}`, d: (next.h - t.h + 360) % 360 };
		})
		.sort((a, b) => a.d - b.d);
</script>

<svelte:head><title>Prototype — Class tone swatches</title></svelte:head>

<div class="bg-muted min-h-screen p-6 pb-24">
	<header class="mx-auto mb-4 max-w-6xl">
		<h1 class="text-lg font-semibold">
			{variant.key} — {variant.name}
		</h1>
		<p class="text-muted-foreground max-w-2xl text-sm">{variant.blurb}</p>
		<p class="text-muted-foreground mt-1.5 text-[11px]">
			Hue gaps (even spacing would be 45°):
			{#each gaps as g (g.pair)}
				<span class={g.d < 35 ? 'font-semibold text-red-500' : ''}>{g.pair} {g.d.toFixed(0)}°</span
				>{' · '}
			{/each}
		</p>
	</header>

	<div class="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2">
		<ToneSheet {variant} theme="light" />
		<ToneSheet {variant} theme="dark" />
	</div>
</div>

<PrototypeSwitcher variants={VARIANTS.map((v) => ({ key: v.key, name: v.name }))} current={key} />
