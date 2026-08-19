<!-- PROTOTYPE — throwaway. Floating variant switcher for the signed-out prototype (issue #56). -->
<script lang="ts">
	import { dev } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let { variants }: { variants: { key: string; name: string }[] } = $props();

	const index = $derived(
		Math.max(
			0,
			variants.findIndex((v) => v.key === (page.url.searchParams.get('variant') ?? variants[0].key))
		)
	);
	const current = $derived(variants[index]);

	function go(delta: number) {
		const next = variants[(index + delta + variants.length) % variants.length];
		const url = new URL(page.url);
		url.searchParams.set('variant', next.key);
		goto(url, { replaceState: true, noScroll: true, keepFocus: true });
	}

	function onkeydown(e: KeyboardEvent) {
		const el = e.target as HTMLElement | null;
		if (el && (el.matches('input, textarea, select') || el.isContentEditable)) return;
		if (e.key === 'ArrowLeft') go(-1);
		if (e.key === 'ArrowRight') go(1);
	}
</script>

<svelte:window {onkeydown} />

{#if dev}
	<div
		class="fixed bottom-4 left-1/2 z-[9999] flex -translate-x-1/2 items-stretch overflow-hidden rounded-full bg-black font-mono text-xs text-white shadow-2xl ring-1 ring-white/20"
	>
		<button
			type="button"
			class="px-3 py-2 hover:bg-white/15"
			onclick={() => go(-1)}
			aria-label="Previous variant">←</button
		>
		<span class="flex items-center gap-2 border-x border-white/20 px-4 py-2 whitespace-nowrap">
			<span class="font-bold">{current.key}</span>
			<span class="text-white/60">{current.name}</span>
		</span>
		<button
			type="button"
			class="px-3 py-2 hover:bg-white/15"
			onclick={() => go(1)}
			aria-label="Next variant">→</button
		>
	</div>
{/if}
