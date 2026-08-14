<script lang="ts">
	// PROTOTYPE — throwaway. The floating variant switcher. Delete with the route.
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { dev } from '$app/environment';

	let { variants }: { variants: { key: string; name: string }[] } = $props();

	const current = $derived(page.url.searchParams.get('variant') ?? variants[0].key);
	const index = $derived(
		Math.max(
			0,
			variants.findIndex((v) => v.key === current)
		)
	);

	function go(delta: number) {
		const next = variants[(index + delta + variants.length) % variants.length];
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() can't carry a query string
		goto(`${resolve('/prototype/authoring')}?variant=${next.key}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	function onkeydown(e: KeyboardEvent) {
		const el = document.activeElement as HTMLElement | null;
		if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
		if (e.key === 'ArrowLeft') go(-1);
		if (e.key === 'ArrowRight') go(1);
	}
</script>

<svelte:window {onkeydown} />

{#if dev}
	<div
		class="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-stretch overflow-hidden rounded-full bg-neutral-900 text-sm text-white shadow-2xl ring-1 ring-white/20"
	>
		<button
			class="px-4 py-2.5 text-neutral-300 hover:bg-white/10 hover:text-white"
			onclick={() => go(-1)}
			aria-label="Previous variant">←</button
		>
		<div class="flex items-center gap-2 border-x border-white/15 px-4 py-2.5 whitespace-nowrap">
			<span class="font-mono font-bold">{variants[index].key}</span>
			<span class="text-neutral-300">{variants[index].name}</span>
			<span class="ml-1 font-mono text-[10px] tracking-wider text-neutral-500 uppercase"
				>prototype · #22</span
			>
		</div>
		<button
			class="px-4 py-2.5 text-neutral-300 hover:bg-white/10 hover:text-white"
			onclick={() => go(1)}
			aria-label="Next variant">→</button
		>
	</div>
{/if}
