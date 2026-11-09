<script lang="ts">
	import { resolve } from '$app/paths';
	import { toggleMode } from 'mode-watcher';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import SunIcon from '@lucide/svelte/icons/sun';
	import BuildInfo from '$lib/components/build-info.svelte';
	import FeedbackButton from '$lib/components/feedback-button.svelte';
	import * as Dialog from '$lib/ui/dialog';
	import * as Tooltip from '$lib/ui/tooltip';
	import { Toaster } from '$lib/ui/toast';
	import { SCREENS, isActive, screenTitle, settingsOpen } from './nav';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	let drawerOpen = $state(false);

	const ROW =
		'flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium transition-colors';
	const IDLE = 'text-muted-foreground hover:bg-muted hover:text-foreground';
	const CURRENT = 'bg-primary-container font-semibold text-primary-container-foreground';
	// On a tablet the sidebar shows icons only; the name stays for screen readers.
	const ICONS_BELOW_LG = 'justify-center lg:justify-start';
</script>

<!--
	One row of the sidebar or the drawer: a link or a button, an icon and a name. In the sidebar the
	name is hidden below `lg` and a tooltip shows it instead.
-->
{#snippet row(
	text: string,
	Icon: typeof SettingsIcon,
	{
		href,
		active = false,
		onclick,
		type,
		ariaLabel,
		inSidebar
	}: {
		href?: string;
		active?: boolean;
		onclick?: () => void;
		type?: 'button' | 'submit';
		ariaLabel?: string;
		inSidebar: boolean;
	}
)}
	{@const cls = `${ROW} ${active ? CURRENT : IDLE} ${inSidebar ? ICONS_BELOW_LG : ''}`}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				{#if href}
					<!-- Every caller passes an href already run through resolve(). -->
					<a
						{...props}
						{href}
						onclick={() => (drawerOpen = false)}
						class={cls}
						aria-current={active ? 'page' : undefined}
					>
						<Icon class="size-4 shrink-0" />
						<span class={inSidebar ? 'sr-only lg:not-sr-only' : ''}>{text}</span>
					</a>
				{:else}
					<button {...props} {type} {onclick} aria-label={ariaLabel} class="{cls} w-full">
						<Icon class="size-4 shrink-0" />
						<span class={inSidebar ? 'sr-only lg:not-sr-only' : ''}>{text}</span>
					</button>
				{/if}
			{/snippet}
		</Tooltip.Trigger>
		{#if inSidebar}
			<Tooltip.Content side="right" class="lg:hidden">{ariaLabel ?? text}</Tooltip.Content>
		{/if}
	</Tooltip.Root>
{/snippet}

{#snippet screens(inSidebar: boolean)}
	<nav class="flex flex-col gap-0.5" aria-label="Primary">
		{#each SCREENS as { href, label, icon } (href)}
			{@render row(label, icon, { href, active: isActive(href), inSidebar })}
		{/each}
	</nav>
{/snippet}

{#snippet foot(inSidebar: boolean)}
	<div class="mt-auto flex flex-col gap-0.5 border-t border-divider pt-3">
		{@render row('Settings', SettingsIcon, {
			href: resolve('/settings'),
			active: settingsOpen(),
			inSidebar
		})}
		{#if inSidebar}
			<!-- The drawer has no theme toggle (issue #324). -->
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<button
							{...props}
							type="button"
							onclick={toggleMode}
							aria-label="Toggle theme"
							class="{ROW} {IDLE} {ICONS_BELOW_LG} w-full"
						>
							<SunIcon class="size-4 shrink-0 dark:hidden" />
							<MoonIcon class="hidden size-4 shrink-0 dark:block" />
							<span class="sr-only lg:not-sr-only">Theme</span>
						</button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="right" class="lg:hidden">Toggle theme</Tooltip.Content>
			</Tooltip.Root>
		{/if}
		<form method="POST" action="/logout">
			{@render row('Log out', LogOutIcon, { type: 'submit', inSidebar })}
		</form>
		<BuildInfo class="px-3 pt-1.5 {inSidebar ? 'hidden lg:block' : ''}" />
	</div>
{/snippet}

<div class="min-h-screen bg-background text-foreground">
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
		{@render screens(true)}
		{@render foot(true)}
	</aside>

	<!-- Phone: a top bar and a drawer from the left. -->
	<header class="sticky top-0 z-20 flex h-14 items-center gap-1 border-b bg-surface px-2 md:hidden">
		<Dialog.Root bind:open={drawerOpen}>
			<Dialog.Trigger
				class="inline-flex size-11 items-center justify-center rounded-lg hover:bg-muted"
				aria-label="Menu"
			>
				<MenuIcon class="size-5" />
			</Dialog.Trigger>
			<Dialog.Content side="left" aria-label="Menu">
				<Dialog.Header><Dialog.Title>Planner</Dialog.Title></Dialog.Header>
				{@render screens(false)}
				{@render foot(false)}
			</Dialog.Content>
		</Dialog.Root>
		<span class="text-[17px] font-semibold">{screenTitle()}</span>
	</header>

	<div class="flex min-h-screen flex-col md:pl-16 lg:pl-58">
		<main class="flex flex-1">
			<div class="min-w-0 flex-1">
				{@render children()}
			</div>
		</main>
	</div>
</div>

<Toaster />
<FeedbackButton />
