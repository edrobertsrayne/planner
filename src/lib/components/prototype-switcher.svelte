<script lang="ts">
	// PROTOTYPE, throwaway. A floating bar of independent switches, each one URL parameter, so
	// every combination is a link. Never shown in a production build.
	import { dev } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	type Switch = {
		param: string;
		label: string;
		options: { value: string; name: string; href?: string }[];
		current: string;
	};
	let { switches }: { switches: Switch[] } = $props();

	function pick(s: Switch, o: Switch['options'][number]) {
		const url = new URL(o.href ?? page.url.href, page.url.origin);
		if (!o.href) url.searchParams.set(s.param, o.value);
		else
			for (const [k, v] of page.url.searchParams)
				if (!url.searchParams.has(k)) url.searchParams.set(k, v);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- prototype: path built at runtime
		void goto(url.pathname + url.search, { replaceState: true, noScroll: true, keepFocus: true });
	}
</script>

{#if dev}
	<div
		class="fixed bottom-4 left-1/2 z-50 flex max-w-[96vw] -translate-x-1/2 flex-wrap items-center justify-center gap-x-4 gap-y-1.5 rounded-2xl bg-zinc-950 px-4 py-2 text-xs text-white shadow-xl ring-2 ring-fuchsia-500"
	>
		{#each switches as s (s.param)}
			<div class="flex items-center gap-1.5">
				<span class="text-zinc-400">{s.label}</span>
				<div class="flex overflow-hidden rounded-md ring-1 ring-zinc-700">
					{#each s.options as o (o.value)}
						<button
							class="px-2 py-1 {s.current === o.value
								? 'bg-fuchsia-500 font-medium text-white'
								: 'text-zinc-300 hover:bg-zinc-800'}"
							onclick={() => pick(s, o)}>{o.name}</button
						>
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/if}
