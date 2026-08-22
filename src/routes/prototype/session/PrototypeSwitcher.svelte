<!-- PROTOTYPE — throwaway. Floating bar for flipping between shell variants. -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let { variants, current }: { variants: { key: string; name: string }[]; current: string } =
		$props();

	const index = $derived(variants.findIndex((v) => v.key === current));

	function go(delta: number) {
		const next = variants[(index + delta + variants.length) % variants.length];
		// Keep ?session and ?week across the flip — comparing A against C with the *same* occasion
		// open is the whole point of the bar.
		const url = new URL(page.url);
		url.searchParams.set('variant', next.key);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- prototype-only route
		goto(url, { replaceState: true, noScroll: true, keepFocus: true });
	}

	function onkeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement | null;
		if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
		if (target?.isContentEditable) return;
		if (e.key === 'ArrowLeft') go(-1);
		if (e.key === 'ArrowRight') go(1);
	}
</script>

<svelte:window {onkeydown} />

<div
	class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border bg-neutral-900 px-3 py-1.5 text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
>
	<button type="button" onclick={() => go(-1)} aria-label="Previous variant" class="px-1">←</button>
	<span class="text-xs font-medium tabular-nums">
		{variants[index]?.key} — {variants[index]?.name}
	</span>
	<button type="button" onclick={() => go(1)} aria-label="Next variant" class="px-1">→</button>
</div>
