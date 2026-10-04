<!--
	PROTOTYPE ONLY — the app shell chosen in issue #305 (variant B, sidebar), kept so the Courses
	prototype (issue #306) is judged inside it. Auth guard off in dev.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	import { selectedOccasion } from '$lib/client/session-panel.svelte';
	import ShellB from './prototype-shell/ShellB.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// The panel is open exactly while the URL carries a Session (issue #88), so it survives a
	// reload and Back closes it; the layout renders it once, beside whichever tab is active.
	const occasion = $derived(selectedOccasion());

	let viewport = $state('');
	onMount(() => {
		const on = () => (viewport = `${window.innerWidth}×${window.innerHeight}`);
		on();
		window.addEventListener('resize', on);
		return () => window.removeEventListener('resize', on);
	});
</script>

<ShellB {occasion}>
	{@render children()}
</ShellB>

<Toaster richColors />

<span
	class="fixed top-16 right-2 z-50 rounded bg-yellow-400 px-2 py-0.5 font-mono text-xs text-black"
>
	{viewport}
</span>
