<!-- PROTOTYPE — variant A "Ruled". The school exercise book: a sheet, a margin rule, ink. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children, margin }: { title: string; children: Snippet; margin?: Snippet } =
		$props();

	const today = new Date().toLocaleDateString('en-GB', {
		weekday: 'long',
		day: 'numeric',
		month: 'long'
	});
</script>

<div class="ruled flex min-h-screen items-center px-4 py-10 sm:px-6">
	<div class="mx-auto w-full max-w-[36rem]">
		<header class="mb-6 flex items-baseline justify-between border-b border-[var(--rule)] pb-2">
			<span class="font-mono text-[0.6875rem] tracking-[0.18em] uppercase">Planner</span>
			<span class="font-mono text-[0.6875rem] tracking-[0.08em] text-[var(--muted)]">{today}</span>
		</header>

		<div class="grid grid-cols-[4rem_1fr] sm:grid-cols-[7.5rem_1fr]">
			<!-- the margin rule: an exercise book's red line, and the only place asides live -->
			<div class="relative pr-3 sm:pr-5">
				<div class="absolute top-0 right-0 h-full w-px bg-[var(--margin)]"></div>
				{#if margin}
					<div
						class="pt-28 text-right font-mono text-[0.625rem] leading-[1.6] text-[var(--margin)]"
					>
						{@render margin()}
					</div>
				{/if}
			</div>

			<div class="pl-4 sm:pl-6">
				<h1 class="font-serif text-[2rem] leading-tight font-normal sm:text-[2.5rem]">{title}</h1>
				{@render children()}
			</div>
		</div>
	</div>
</div>

<style>
	.ruled {
		--paper: oklch(0.982 0.009 85);
		--ink: oklch(0.21 0.012 60);
		--rule: oklch(0.87 0.018 240);
		--margin: oklch(0.62 0.16 25);
		--accent: oklch(0.42 0.11 255);
		--muted: oklch(0.53 0.012 70);
		background: var(--paper);
		color: var(--ink);
		font-family: 'Inter Variable', system-ui, sans-serif;
	}
	.ruled :global(.font-serif) {
		font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
	}
</style>
