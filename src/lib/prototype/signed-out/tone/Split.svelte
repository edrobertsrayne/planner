<!-- PROTOTYPE — variant C "Tone". A split: the eight Class tones as a full-height colour field
     on the left, the form quiet on the right. Puts the tone palette (issue #59) on screen at
     full strength before anything commits to it. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, lead, children }: { title: string; lead?: string; children: Snippet } = $props();

	// the eight Class tones, at panel strength rather than the 100-level used on the calendar
	const TONES = [
		{ h: 80, c: 0.02 },
		{ h: 155, c: 0.11 },
		{ h: 240, c: 0.11 },
		{ h: 295, c: 0.11 },
		{ h: 75, c: 0.12 },
		{ h: 15, c: 0.12 },
		{ h: 190, c: 0.1 },
		{ h: 330, c: 0.12 }
	];
</script>

<div class="tone flex min-h-screen flex-col lg:flex-row">
	<!-- the colour field -->
	<div class="relative flex shrink-0 lg:w-[36%] lg:max-w-[30rem]">
		<div class="flex w-full flex-row lg:flex-col" aria-hidden="true">
			{#each TONES as t, i (i)}
				<div
					class="h-2.5 flex-1 lg:h-auto lg:w-full"
					style="background: oklch(0.55 {t.c} {t.h})"
				></div>
			{/each}
		</div>
		<div class="absolute inset-0 hidden flex-col justify-between p-10 lg:flex">
			<span class="text-sm font-semibold tracking-[0.2em] text-white uppercase drop-shadow"
				>Planner</span
			>
			<p class="max-w-[16rem] text-lg leading-snug font-medium text-white drop-shadow">
				One teacher. One timetable. Everything you planned, on the days it actually happens.
			</p>
		</div>
	</div>

	<!-- the form -->
	<div class="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
		<div class="w-full max-w-[24rem]">
			<span class="mb-8 block text-sm font-semibold tracking-[0.2em] uppercase lg:hidden"
				>Planner</span
			>
			<h1 class="text-[1.75rem] leading-tight font-semibold tracking-tight">{title}</h1>
			{#if lead}
				<p class="mt-2 text-sm leading-relaxed text-[var(--muted)]">{lead}</p>
			{/if}
			{@render children()}
		</div>
	</div>
</div>

<style>
	.tone {
		--bg: oklch(0.993 0.002 260);
		--ink: oklch(0.2 0.022 265);
		--muted: oklch(0.52 0.015 265);
		--line: oklch(0.9 0.008 265);
		--accent: oklch(0.48 0.09 190);
		background: var(--bg);
		color: var(--ink);
		font-family: 'Inter Variable', system-ui, sans-serif;
	}
</style>
