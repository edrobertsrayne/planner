<script lang="ts">
	// PROTOTYPE, throwaway. Cycles `?variant=` on the current page. Never shown in a production build.
	import { dev } from '$app/environment';
	import { page } from '$app/state';
	import { replaceQuery } from '$lib/client/enhance';
	import { withParam } from '$lib/query';

	let { variants, current }: { variants: { key: string; name: string }[]; current: string } =
		$props();

	const index = $derived(
		Math.max(
			0,
			variants.findIndex((v) => v.key === current)
		)
	);
	const go = (delta: number) => {
		const next = variants[(index + delta + variants.length) % variants.length];
		void replaceQuery(withParam(page.url, 'variant', next.key));
	};

	function onkeydown(e: KeyboardEvent) {
		const t = e.target as HTMLElement | null;
		if (t?.closest('input, textarea, select, [contenteditable]')) return;
		if (e.key === 'ArrowLeft') go(-1);
		if (e.key === 'ArrowRight') go(1);
	}
</script>

<svelte:window {onkeydown} />

{#if dev}
	<div
		class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black px-2 py-1.5 text-sm text-white shadow-xl ring-2 ring-fuchsia-400"
	>
		<button
			class="rounded-full px-2 hover:bg-white/20"
			onclick={() => go(-1)}
			aria-label="Previous variant">←</button
		>
		<span class="font-medium">{variants[index].key} ({variants[index].name})</span>
		<button
			class="rounded-full px-2 hover:bg-white/20"
			onclick={() => go(1)}
			aria-label="Next variant">→</button
		>
	</div>
{/if}
