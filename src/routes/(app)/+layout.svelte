<script lang="ts">
	import { resolve } from '$app/paths';
	import { toggleMode } from 'mode-watcher';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import BuildInfo from '$lib/components/build-info.svelte';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Toaster } from '$lib/components/ui/sonner';
	import { selectedOccasion } from '$lib/client/session-panel.svelte';
	import SearchRoom from './SearchRoom.svelte';
	import SessionPanel from './SessionPanel.svelte';
	import { SCREENS, isActive, screenTitle } from './nav';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	// The panel is open exactly while the URL carries a Session (issue #88), so it survives a
	// reload and Back closes it; the layout renders it once, beside whichever screen is open.
	const occasion = $derived(selectedOccasion());

	let drawerOpen = $state(false);

	// Settings is not one of the five screens, so no screen is lit while it is open.
	const settingsOpen = $derived(isActive(resolve('/settings')));

	const ROW =
		'flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors pointer-coarse:min-h-11';
	const IDLE = 'text-muted-foreground hover:bg-muted/60 hover:text-foreground';
	// On a tablet the rail shows icons only; the label stays for screen readers.
	const RAIL = 'justify-center lg:justify-start';
</script>

<!-- A row of the sidebar or the drawer. `rail` rows lose their label below `lg`. -->
{#snippet label(text: string, rail: boolean)}
	<span class={rail ? 'sr-only lg:not-sr-only' : ''}>{text}</span>
{/snippet}

{#snippet railTip(text: string, rail: boolean)}
	{#if rail}<Tooltip.Content side="right" class="lg:hidden">{text}</Tooltip.Content>{/if}
{/snippet}

{#snippet screens(rail: boolean)}
	<nav class="flex flex-col gap-0.5" aria-label="Primary">
		{#each SCREENS as { href, label: text, icon: Icon } (href)}
			{@const active = isActive(href)}
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<a
							{...props}
							{href}
							onclick={() => (drawerOpen = false)}
							class="{ROW} {active ? 'bg-muted text-foreground' : IDLE} {rail ? RAIL : ''}"
							aria-current={active ? 'page' : undefined}
						>
							<Icon class="size-4 shrink-0" />
							{@render label(text, rail)}
						</a>
					{/snippet}
				</Tooltip.Trigger>
				{@render railTip(text, rail)}
			</Tooltip.Root>
		{/each}
	</nav>
{/snippet}

{#snippet foot(rail: boolean)}
	<div class="mt-auto flex flex-col gap-0.5">
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<a
						{...props}
						href={resolve('/settings')}
						onclick={() => (drawerOpen = false)}
						class="{ROW} {settingsOpen ? 'bg-muted text-foreground' : IDLE} {rail ? RAIL : ''}"
					>
						<SettingsIcon class="size-4 shrink-0" />
						{@render label('Settings', rail)}
					</a>
				{/snippet}
			</Tooltip.Trigger>
			{@render railTip('Settings', rail)}
		</Tooltip.Root>

		{#if rail}
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<button
							{...props}
							type="button"
							onclick={toggleMode}
							aria-label="Toggle theme"
							class="{ROW} {IDLE} {RAIL}"
						>
							<MoonIcon class="size-4 shrink-0" />
							{@render label('Theme', rail)}
						</button>
					{/snippet}
				</Tooltip.Trigger>
				{@render railTip('Toggle theme', rail)}
			</Tooltip.Root>
		{/if}

		<form method="POST" action="/logout">
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<button {...props} type="submit" class="{ROW} {IDLE} w-full {rail ? RAIL : ''}">
							<LogOutIcon class="size-4 shrink-0" />
							{@render label('Log out', rail)}
						</button>
					{/snippet}
				</Tooltip.Trigger>
				{@render railTip('Log out', rail)}
			</Tooltip.Root>
		</form>
		<BuildInfo class="px-2.5 pt-2 {rail ? 'hidden lg:block' : ''}" />
	</div>
{/snippet}

<Tooltip.Provider>
	<div class="min-h-screen bg-background text-foreground">
		{#if data.user}
			<!-- Laptop and tablet: a fixed sidebar, 14 rem labelled or 4 rem icons only. -->
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
				<SearchRoom class="hidden lg:flex" />
				<SearchRoom compact class="mx-auto lg:hidden" />
				{@render screens(true)}
				{@render foot(true)}
			</aside>

			<!-- Phone: a top bar and a drawer from the left. -->
			<header
				class="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background px-2 md:hidden"
			>
				<Sheet.Root bind:open={drawerOpen}>
					<Sheet.Trigger
						class="inline-flex size-11 items-center justify-center rounded-md hover:bg-muted"
						aria-label="Menu"
					>
						<MenuIcon class="size-5" />
					</Sheet.Trigger>
					<Sheet.Content side="left" class="w-72 gap-4 p-4">
						<Sheet.Header class="p-0"><Sheet.Title>Planner</Sheet.Title></Sheet.Header>
						{@render screens(false)}
						{@render foot(false)}
					</Sheet.Content>
				</Sheet.Root>
				<span class="font-semibold">{screenTitle()}</span>
				<SearchRoom compact class="ml-auto" />
			</header>
		{/if}

		<div class="flex min-h-screen flex-col {data.user ? 'md:pl-16 lg:pl-56' : ''}">
			<main class="flex flex-1">
				<div class="min-w-0 flex-1">
					{@render children()}
				</div>
				{#if occasion}
					<SessionPanel {occasion} />
				{/if}
			</main>
		</div>
	</div>
</Tooltip.Provider>

<Toaster richColors />
