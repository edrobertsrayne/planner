<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { Button } from '$lib/components/ui/button';

	let {
		variants
	}: {
		variants: readonly (readonly [key: string, label: string])[];
	} = $props();

	const key = $derived(page.url.searchParams.get('variant') ?? variants[0][0]);
	const label = $derived(variants.find(([k]) => k === key)?.[1] ?? variants[0][1]);

	async function cycle(dir: 1 | -1) {
		const i = variants.findIndex(([k]) => k === key);
		const next = variants[(i + dir + variants.length) % variants.length][0];
		const url = new URL(page.url.href);
		url.searchParams.set('variant', next);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- carries a query string
		await goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
	}

	function onkeydown(e: KeyboardEvent) {
		const el = document.activeElement as HTMLElement | null;
		if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
		if (e.key === 'ArrowLeft') cycle(-1);
		else if (e.key === 'ArrowRight') cycle(1);
	}
</script>

<svelte:window {onkeydown} />

<div
	class="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-popover py-1 pr-1.5 pl-1.5 shadow-lg"
>
	<Button variant="ghost" size="icon-sm" aria-label="Previous variant" onclick={() => cycle(-1)}>
		<ChevronLeftIcon />
	</Button>
	<span class="min-w-56 text-center text-xs font-medium">{label}</span>
	<Button variant="ghost" size="icon-sm" aria-label="Next variant" onclick={() => cycle(1)}>
		<ChevronRightIcon />
	</Button>
</div>
