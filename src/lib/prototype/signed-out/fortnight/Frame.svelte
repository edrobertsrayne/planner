<!-- PROTOTYPE — variant B "Fortnight". The product's own artifact is the ground: a two-week
     timetable, ghosted, full bleed. The card sits in it like a booked period. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();

	const DAYS = ['M', 'T', 'W', 'T', 'F'];
	const PERIODS = 6;
	// a plausible teaching load, so the ground reads as a real fortnight rather than graph paper
	const BOOKED = new Set([
		'0-0',
		'0-2',
		'0-5',
		'1-1',
		'1-3',
		'2-0',
		'2-4',
		'3-2',
		'3-3',
		'4-1',
		'4-5',
		'5-0',
		'5-3',
		'6-1',
		'6-4',
		'7-2',
		'7-5',
		'8-0',
		'8-3',
		'9-1',
		'9-4'
	]);
	const HUES = [255, 155, 78, 305, 25, 195];
	// real-looking codes so the ground reads as a timetable, not wallpaper
	const CODES = ['9Y/Ph', '10A/Ma', '8B/Sc', '11C/Ph', '7D/Sc', '12A/Ph', '9X/Ma', '10B/Sc'];
</script>

<div class="fortnight relative min-h-screen overflow-hidden">
	<!-- the ground -->
	<div class="pointer-events-none absolute inset-0 flex flex-col opacity-[0.6]" aria-hidden="true">
		<div class="grid grid-cols-10 border-b border-[var(--line)] bg-[var(--ground)]">
			{#each ['A', 'B'] as week (week)}
				{#each DAYS as d, i (week + i)}
					<div
						class="py-2 text-center font-mono text-[0.5625rem] tracking-[0.2em] text-[var(--muted)]"
					>
						{week}{d}
					</div>
				{/each}
			{/each}
		</div>
		<div class="grid flex-1 grid-cols-10 grid-rows-6 gap-px bg-[var(--line)]">
			{#each { length: 10 } as _, col (col)}
				{#each { length: PERIODS } as _, row (row)}
					{@const booked = BOOKED.has(`${col}-${row}`)}
					<div
						class="flex bg-[var(--ground)] p-1.5 font-mono text-[0.5625rem] tracking-wide"
						style={booked
							? `background: oklch(0.30 0.055 ${HUES[(col + row) % HUES.length]}); color: oklch(0.78 0.06 ${HUES[(col + row) % HUES.length]})`
							: undefined}
					>
						{#if booked}{CODES[(col * 3 + row) % CODES.length]}{/if}
					</div>
				{/each}
			{/each}
		</div>
	</div>

	<!-- the card, snapped over the grid -->
	<div class="relative flex min-h-screen items-center justify-center p-4">
		<div
			class="w-full max-w-[26rem] border border-[var(--line)] bg-[var(--surface)] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)]"
		>
			<div class="flex items-center justify-between border-b border-[var(--line)] px-6 py-3">
				<span class="font-mono text-[0.6875rem] tracking-[0.2em] uppercase">Planner</span>
			</div>
			<div class="px-6 py-7">
				{@render children()}
			</div>
		</div>
	</div>
</div>

<style>
	.fortnight {
		--ground: oklch(0.17 0.015 255);
		--surface: oklch(0.235 0.016 255);
		--line: oklch(0.33 0.018 255);
		--fg: oklch(0.96 0.006 90);
		--muted: oklch(0.68 0.012 255);
		--accent: oklch(0.8 0.155 78);
		background: var(--ground);
		color: var(--fg);
		font-family: 'Inter Variable', system-ui, sans-serif;
	}
</style>
