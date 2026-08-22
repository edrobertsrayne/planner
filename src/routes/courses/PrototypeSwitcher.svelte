<!--
	PROTOTYPE — throwaway. Floating bar, single axis: which variant of the Courses/Lesson-editing
	screen. See #64.
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

	function nav(variant: string) {
		const url = new URL(page.url);
		url.searchParams.set('variant', variant);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- prototype-only param
		goto(url, { replaceState: true, noScroll: true, keepFocus: true });
	}

	function go(delta: number) {
		nav(variants[(index + delta + variants.length) % variants.length].key);
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
	<span class="min-w-64 text-center text-xs font-medium">
		{variants[index]?.key} — {variants[index]?.name}
	</span>
	<button type="button" onclick={() => go(1)} aria-label="Next variant" class="px-1">→</button>
</div>
