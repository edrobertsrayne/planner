<!--
	PROTOTYPE ONLY — issue #305 "How does the app shell navigate on laptop, tablet and phone?"
	Four app-shell variants, switchable via `?shell=A|B|C|D` (remembered in a cookie, so the real
	tabs keep it), around the real screens and the real dev data. Auth guard off in dev.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	import PrototypeSwitcher from '$lib/components/prototype-switcher.svelte';
	import { selectedOccasion } from '$lib/client/session-panel.svelte';
	import ShellA from './prototype-shell/ShellA.svelte';
	import ShellB from './prototype-shell/ShellB.svelte';
	import ShellC from './prototype-shell/ShellC.svelte';
	import ShellD from './prototype-shell/ShellD.svelte';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	// The panel is open exactly while the URL carries a Session (issue #88), so it survives a
	// reload and Back closes it; the layout renders it once, beside whichever tab is active.
	const occasion = $derived(selectedOccasion());

	const VARIANTS = [
		{ key: 'A', label: 'Top tabs, phone bottom bar' },
		{ key: 'B', label: 'Sidebar, phone drawer' },
		{ key: 'C', label: 'Teach / Plan, next-Session pill' },
		{ key: 'D', label: 'Screen menu + search, no tabs' }
	];
	const Shell = $derived({ A: ShellA, B: ShellB, C: ShellC, D: ShellD }[data.shell] ?? ShellA);

	let viewport = $state('');
	onMount(() => {
		const on = () => (viewport = `${window.innerWidth}×${window.innerHeight}`);
		on();
		window.addEventListener('resize', on);
		return () => window.removeEventListener('resize', on);
	});
</script>

<Shell {occasion} next={data.nextSession}>
	{@render children()}
</Shell>

<Toaster richColors />

<span
	class="fixed top-16 right-2 z-50 rounded bg-yellow-400 px-2 py-0.5 font-mono text-xs text-black"
>
	{viewport}
</span>

<PrototypeSwitcher variants={VARIANTS} current={data.shell} paramName="shell" />
