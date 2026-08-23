<!--
	PROTOTYPE — throwaway. Floating bar, three axes, because #68 asks three separable questions:
	the layout (arrows, or ←/→), how loud the Class tone is (`tone`), and how full the window is
	(`data`) — the empty and sparse states the ticket wants seen. Theme is the app's own toggle in
	the header, so it isn't an axis here.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let {
		variants,
		current,
		tone,
		data
	}: {
		variants: { key: string; name: string }[];
		current: string;
		tone: string;
		data: string;
	} = $props();

	const TONES = [
		{ key: 'tint', name: 'Tint' },
		{ key: 'block', name: 'Block' }
	];
	const DATA = [
		{ key: 'full', name: 'Full' },
		{ key: 'sparse', name: 'Sparse' },
		{ key: 'empty', name: 'Empty' }
	];

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

{#snippet pills(
	options: { key: string; name: string }[],
	active: string,
	param: string,
	label: string
)}
	<div class="flex items-center rounded-full bg-white/10 p-0.5 dark:bg-black/10" aria-label={label}>
		{#each options as o (o.key)}
			<button
				type="button"
				onclick={() => nav({ [param]: o.key })}
				class="rounded-full px-2.5 py-0.5 text-xs font-medium {active === o.key
					? 'bg-white text-neutral-900 dark:bg-neutral-900 dark:text-white'
					: 'opacity-70'}"
			>
				{o.name}
			</button>
		{/each}
	</div>
{/snippet}

<div
	data-prototype-chrome
	class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-neutral-900 py-1.5 pr-3 pl-2 text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
>
	{@render pills(TONES, tone, 'tone', 'Tone strength')}
	{@render pills(DATA, data, 'data', 'How full the window is')}

	<button type="button" onclick={() => go(-1)} aria-label="Previous variant" class="px-1">←</button>
	<span class="min-w-40 text-center text-xs font-medium">
		{variants[index]?.key} — {variants[index]?.name}
	</span>
	<button type="button" onclick={() => go(1)} aria-label="Next variant" class="px-1">→</button>
</div>
