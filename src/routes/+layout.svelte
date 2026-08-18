<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { sessionPanel } from '$lib/client/session-panel.svelte';
	import SessionPanel from './SessionPanel.svelte';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	const TABS = [
		['/', 'Agenda'],
		['/calendar', 'Calendar'],
		['/classes', 'Classes'],
		['/courses', 'Courses']
	] as const;
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex min-h-screen flex-col bg-neutral-50 text-neutral-900">
	<header class="border-b border-neutral-200 bg-white">
		<div class="mx-auto flex max-w-6xl items-baseline gap-4 px-6 pt-5">
			<h1 class="text-lg font-semibold tracking-tight">Planner</h1>
			{#if data.user}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- static internal route -->
				<a href="/settings" class="ml-auto text-sm text-neutral-500 hover:text-neutral-800"
					>Settings</a
				>
				<form method="POST" action="/logout">
					<button type="submit" class="text-sm text-neutral-500 hover:text-neutral-800"
						>Log out</button
					>
				</form>
			{/if}
		</div>
		<nav class="mx-auto flex max-w-6xl gap-1 px-6 pt-4">
			{#each TABS as [href, label] (href)}
				{@const active =
					href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href)}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- static internal route -->
				<a
					{href}
					class="-mb-px border-b-2 px-4 py-2 text-sm font-medium {active
						? 'border-neutral-900 text-neutral-900'
						: 'border-transparent text-neutral-500 hover:text-neutral-800'}">{label}</a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/each}
		</nav>
	</header>

	<main class="flex min-h-0 flex-1">
		<div class="min-w-0 flex-1 overflow-y-auto">
			{@render children()}
		</div>
		{#if sessionPanel.selected}
			<SessionPanel occasion={sessionPanel.selected} onclose={() => sessionPanel.close()} />
		{/if}
	</main>
</div>
