<!--
	PROTOTYPE — throwaway. Floating bar, one axis: which tone curve. Both themes are on screen at
	once, so there is no theme axis to switch — #67 is judged by comparing them side by side.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let {
		variants,
		current
	}: {
		variants: { key: string; name: string }[];
		current: string;
	} = $props();

	const index = $derived(variants.findIndex((v) => v.key === current));

	function nav(params: Record<string, string>) {
		const url = new URL(page.url);
		for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- prototype-only route
		goto(url, { replaceState: true, noScroll: true, keepFocus: true });
	}

	function go(delta: number) {
		nav({ variant: variants[(index + delta + variants.length) % variants.length].key });
	}

	function onkeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement | null;
		if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
		if (target?.isContentEditable) return;
		if (e.key === 'ArrowLeft') go(-1);
		if (e.key === 'ArrowRight') go(1);
	}
</script>

<svelte:window {onkeydown} />

<div
	data-prototype-chrome
	class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-neutral-900 py-1.5 pr-3 pl-2 text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
>
	<button type="button" onclick={() => go(-1)} aria-label="Previous variant" class="px-1">←</button>
	<span class="min-w-40 text-center text-xs font-medium">
		{variants[index]?.key} — {variants[index]?.name}
	</span>
	<button type="button" onclick={() => go(1)} aria-label="Next variant" class="px-1">→</button>
</div>
