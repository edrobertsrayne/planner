<!--
	PROTOTYPE — throwaway. Variant A: top tabs, closest to today's shape.

	Honesty note: four tabs read fine. If Agenda and Calendar merge into one
	destination, this shape still works (three tabs); it only strains if a
	fifth top-level destination shows up later.
-->
<script lang="ts">
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import AccountMenu from './AccountMenu.svelte';
	import AccountLinks from './AccountLinks.svelte';
	import MockSessionPanel from './MockSessionPanel.svelte';
	import PlaceholderContent from './PlaceholderContent.svelte';

	const TABS = ['Agenda', 'Calendar', 'Classes', 'Courses'];
	let active = $state('Agenda');
	let showSession = $state(true);
	// PROTOTYPE-only sub-choice: the user asked to compare a combined avatar
	// menu against separate visible controls before settling account actions.
	let accountStyle = $state<'menu' | 'links'>('menu');
</script>

<div class="flex h-full min-h-0 flex-col bg-background">
	<header class="sticky top-0 z-10 border-b bg-background">
		<div class="flex items-center gap-6 px-6 pt-4">
			<div class="flex items-center gap-2">
				<div
					class="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
				>
					<CalendarDaysIcon class="size-4" />
				</div>
				<span class="text-sm font-semibold tracking-tight">Planner</span>
			</div>

			<nav class="flex flex-1 gap-1">
				{#each TABS as tab (tab)}
					<button
						type="button"
						onclick={() => (active = tab)}
						class="-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors {active === tab
							? 'border-foreground text-foreground'
							: 'border-transparent text-muted-foreground hover:text-foreground'}"
					>
						{tab}
					</button>
				{/each}
			</nav>

			{#if accountStyle === 'menu'}
				<AccountMenu />
			{:else}
				<AccountLinks />
			{/if}
		</div>
	</header>

	<div class="border-b bg-muted/40 px-6 py-1.5">
		<button
			type="button"
			class="text-xs text-muted-foreground underline"
			onclick={() => (accountStyle = accountStyle === 'menu' ? 'links' : 'menu')}
		>
			Account actions: {accountStyle === 'menu' ? 'avatar dropdown' : 'separate links'} — click to switch
		</button>
	</div>

	<main class="flex min-h-0 flex-1">
		<div class="min-w-0 flex-1 overflow-y-auto px-6 py-6">
			<PlaceholderContent title={active} />
			<button
				type="button"
				class="mt-6 text-xs text-muted-foreground underline"
				onclick={() => (showSession = !showSession)}
			>
				{showSession ? 'Hide' : 'Show'} mock session panel
			</button>
		</div>
		{#if showSession}
			<MockSessionPanel onclose={() => (showSession = false)} />
		{/if}
	</main>
</div>
