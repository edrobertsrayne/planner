<!--
	PROTOTYPE — throwaway route. Three variants of the app shell (issue #60),
	switchable via ?variant=A|B|C, wrapped around placeholder content so the
	frame is judged on its own. See PrototypeSwitcher for the floating bar.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { ModeWatcher } from 'mode-watcher';
	import ShellA from './ShellA.svelte';
	import ShellB from './ShellB.svelte';
	import ShellC from './ShellC.svelte';
	import PrototypeSwitcher from './PrototypeSwitcher.svelte';

	const VARIANTS = [
		{ key: 'A', name: 'Top tabs' },
		{ key: 'B', name: 'Sidebar' },
		{ key: 'C', name: 'Icon rail' }
	];

	const variant = $derived(page.url.searchParams.get('variant') ?? 'A');
</script>

<ModeWatcher />

<div class="h-screen">
	{#if variant === 'B'}
		<ShellB />
	{:else if variant === 'C'}
		<ShellC />
	{:else}
		<ShellA />
	{/if}
</div>

<PrototypeSwitcher variants={VARIANTS} current={variant} />
