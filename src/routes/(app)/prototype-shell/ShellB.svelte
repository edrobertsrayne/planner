<!--
	PROTOTYPE ONLY (issue #305). Variant B: a sidebar. Labelled on laptop, icons only on tablet, a
	drawer behind a menu button on a phone. No top header on laptop and tablet: the page starts at
	the top of the window.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import { toggleMode } from 'mode-watcher';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import BuildInfo from '$lib/components/build-info.svelte';
	import * as Sheet from '$lib/components/ui/sheet';
	import type { Occasion } from '$lib/client/session-panel.svelte';
	import SessionPanel from '../SessionPanel.svelte';
	import NextSessionButton from './NextSessionButton.svelte';
	import SearchSlot from './SearchSlot.svelte';
	import { SCREENS, isActive, screenTitle, type NextSession } from './nav';

	let {
		children,
		occasion,
		next
	}: { children: Snippet; occasion: Occasion | null; next: NextSession | null } = $props();

	let drawer = $state(false);
	const settingsActive = $derived(isActive(resolve('/settings')));
</script>

{#snippet item(
	href: string,
	label: string,
	Icon: typeof SettingsIcon,
	active: boolean,
	rail: boolean
)}
	<a
		{href}
		title={label}
		onclick={() => (drawer = false)}
		class="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors {active
			? 'bg-muted text-foreground'
			: 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'} {rail
			? 'justify-center lg:justify-start'
			: ''}"
		aria-current={active ? 'page' : undefined}
	>
		<Icon class="size-4 shrink-0" />
		<span class={rail ? 'hidden lg:inline' : ''}>{label}</span>
	</a>
{/snippet}

{#snippet navList(rail: boolean)}
	<nav class="flex flex-col gap-0.5" aria-label="Primary">
		{#each SCREENS as s (s.href)}
			{@render item(s.href, s.label, s.icon, isActive(s.href), rail)}
		{/each}
	</nav>
{/snippet}

<div
	class="min-h-screen bg-background text-foreground [--shell-bottom:0px] [--shell-top:3.5rem] md:[--shell-top:0px]"
>
	<!-- Laptop and tablet: the fixed sidebar. -->
	<aside
		class="fixed inset-y-0 left-0 z-20 hidden w-16 flex-col gap-4 border-r bg-background px-2 py-3 md:flex lg:w-56 lg:px-3"
	>
		<div class="flex items-center gap-2 px-1.5 lg:px-1">
			<div
				class="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
			>
				<CalendarDaysIcon class="size-4" />
			</div>
			<span class="hidden font-semibold lg:inline">Planner</span>
		</div>
		<SearchSlot class="hidden lg:flex" />
		<SearchSlot compact class="mx-auto lg:hidden" />
		{@render navList(true)}

		<div class="mt-auto flex flex-col gap-0.5">
			{@render item(resolve('/settings'), 'Settings', SettingsIcon, settingsActive, true)}
			<button
				type="button"
				onclick={toggleMode}
				title="Toggle theme"
				class="flex items-center justify-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground lg:justify-start"
			>
				<MoonIcon class="size-4 shrink-0" /><span class="hidden lg:inline">Theme</span>
			</button>
			<form method="POST" action="/logout">
				<button
					type="submit"
					title="Log out"
					class="flex w-full items-center justify-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground lg:justify-start"
				>
					<LogOutIcon class="size-4 shrink-0" /><span class="hidden lg:inline">Log out</span>
				</button>
			</form>
			<BuildInfo class="hidden px-2.5 pt-2 lg:block" />
		</div>
	</aside>

	<!-- Phone: a top bar with a drawer. -->
	<header
		class="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background px-2 md:hidden"
	>
		<Sheet.Root bind:open={drawer}>
			<Sheet.Trigger
				class="inline-flex size-10 items-center justify-center rounded-md hover:bg-muted"
				aria-label="Menu"
			>
				<MenuIcon class="size-5" />
			</Sheet.Trigger>
			<Sheet.Content side="left" class="w-72 gap-4 p-4">
				<Sheet.Header class="p-0"><Sheet.Title>Planner</Sheet.Title></Sheet.Header>
				{@render navList(false)}
				<div class="mt-auto flex flex-col gap-0.5">
					{@render item(resolve('/settings'), 'Settings', SettingsIcon, settingsActive, false)}
					<form method="POST" action="/logout">
						<button
							type="submit"
							class="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60"
						>
							<LogOutIcon class="size-4" /> Log out
						</button>
					</form>
					<BuildInfo class="px-2.5 pt-2" />
				</div>
			</Sheet.Content>
		</Sheet.Root>
		<span class="font-semibold">{screenTitle()}</span>
		<div class="ml-auto flex items-center gap-1">
			<SearchSlot compact />
			<NextSessionButton {next} look="icon" class="size-10" />
		</div>
	</header>

	<div class="flex min-h-screen flex-col md:pl-16 lg:pl-56">
		<main class="flex flex-1">
			<div class="min-w-0 flex-1">{@render children()}</div>
			{#if occasion}<SessionPanel {occasion} />{/if}
		</main>
	</div>
</div>
