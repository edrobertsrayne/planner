<!--
	PROTOTYPE ONLY — throwaway UI-prototype infrastructure (see .agents/skills/prototype/UI.md).
	Floating bottom bar that cycles a `?variant=` search param. Never ships: gated on dev mode by
	its only caller, and dropped from main once a variant wins.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	let {
		variants,
		current,
		paramName = 'variant'
	}: {
		variants: { key: string; label: string }[];
		current: string;
		paramName?: string;
	} = $props();

	const index = $derived(
		Math.max(
			0,
			variants.findIndex((v) => v.key === current)
		)
	);

	function go(delta: number) {
		const next = variants[(index + delta + variants.length) % variants.length];
		const url = new URL(page.url);
		url.searchParams.set(paramName, next.key);
		goto(url, { replaceState: true, noScroll: true, keepFocus: true });
	}

	function onkeydown(e: KeyboardEvent) {
		const el = document.activeElement as HTMLElement | null;
		const typing =
			el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
		if (typing) return;
		if (e.key === 'ArrowLeft') go(-1);
		if (e.key === 'ArrowRight') go(1);
	}
</script>

<svelte:window {onkeydown} />

<div
	class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border-2 border-yellow-400 bg-black/90 px-3 py-1.5 text-white shadow-lg"
>
	<button
		type="button"
		aria-label="Previous variant"
		class="rounded-full p-1 hover:bg-white/20"
		onclick={() => go(-1)}
	>
		<ChevronLeftIcon class="size-4" />
	</button>
	<span class="min-w-40 text-center text-xs font-medium tracking-wide">
		PROTOTYPE · {variants[index]?.key} — {variants[index]?.label}
	</span>
	<button
		type="button"
		aria-label="Next variant"
		class="rounded-full p-1 hover:bg-white/20"
		onclick={() => go(1)}
	>
		<ChevronRightIcon class="size-4" />
	</button>
</div>
