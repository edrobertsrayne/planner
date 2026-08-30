<!-- PROTOTYPE — throwaway floating bar. Cycles ?variant= with the arrows or the arrow keys. -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let {
		variants,
		names,
		current
	}: { variants: string[]; names: Record<string, string>; current: string } = $props();

	function go(step: number) {
		const i = variants.indexOf(current);
		const next = variants[(i + step + variants.length) % variants.length];
		const week = page.url.searchParams.get('week');
		const query = week ? `week=${week}&variant=${next}` : `variant=${next}`;
		goto(resolve(`/calendar?${query}`), { replaceState: true, noScroll: true, keepFocus: true });
	}

	function onkeydown(e: KeyboardEvent) {
		const el = e.target as HTMLElement | null;
		if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
		if (e.key === 'ArrowLeft') go(-1);
		if (e.key === 'ArrowRight') go(1);
	}
</script>

<svelte:window {onkeydown} />

<div
	class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black px-2 py-1 text-white shadow-lg"
>
	<button
		type="button"
		class="px-2 py-1 text-sm"
		onclick={() => go(-1)}
		aria-label="Previous variant">←</button
	>
	<span class="px-2 text-xs font-medium whitespace-nowrap">{current} · {names[current]}</span>
	<button type="button" class="px-2 py-1 text-sm" onclick={() => go(1)} aria-label="Next variant"
		>→</button
	>
</div>
