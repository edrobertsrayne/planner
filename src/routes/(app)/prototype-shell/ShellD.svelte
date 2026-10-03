<!--
	PROTOTYPE ONLY (issue #305). Variant D — departs from today's tabs. No tab row: the screen name is
	a menu that switches screen (keys 1–5 also switch), and the search slot gets the middle of the
	bar. One bar shape at every size.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import BuildInfo from '$lib/components/build-info.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import type { Occasion } from '$lib/client/session-panel.svelte';
	import SessionPanel from '../SessionPanel.svelte';
	import AccountMenu from './AccountMenu.svelte';
	import NextSessionButton from './NextSessionButton.svelte';
	import SearchSlot from './SearchSlot.svelte';
	import { SCREENS, currentScreen, screenTitle, type NextSession } from './nav';

	let {
		children,
		occasion,
		next
	}: { children: Snippet; occasion: Occasion | null; next: NextSession | null } = $props();

	function onkeydown(e: KeyboardEvent) {
		const el = document.activeElement as HTMLElement | null;
		if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		const n = Number(e.key);
		if (n >= 1 && n <= SCREENS.length) void goto(SCREENS[n - 1].href);
	}
	const Current = $derived(currentScreen()?.icon ?? SettingsIcon);
</script>

<svelte:window {onkeydown} />

<div
	class="flex min-h-screen flex-col bg-background text-foreground [--shell-bottom:0px] [--shell-top:3.5rem]"
>
	<header class="sticky top-0 z-20 h-14 border-b bg-background">
		<div class="mx-auto flex h-full max-w-6xl items-center gap-3 px-3 md:px-6">
			<div
				class="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
			>
				<CalendarDaysIcon class="size-4" />
			</div>

			<DropdownMenu.Root>
				<DropdownMenu.Trigger
					class="flex items-center gap-2 rounded-md px-2 py-1.5 text-base font-semibold hover:bg-muted"
				>
					<Current class="size-4 text-muted-foreground" />
					{screenTitle()}
					<ChevronDownIcon class="size-4 text-muted-foreground" />
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="start" class="w-56">
					{#each SCREENS as s, i (s.href)}
						<DropdownMenu.Item>
							{#snippet child({ props })}
								<a {...props} href={s.href}>
									<s.icon />
									{s.label}
									<DropdownMenu.Shortcut>{i + 1}</DropdownMenu.Shortcut>
								</a>
							{/snippet}
						</DropdownMenu.Item>
					{/each}
					<DropdownMenu.Separator />
					<DropdownMenu.Item>
						{#snippet child({ props })}
							<a {...props} href={resolve('/settings')}><SettingsIcon /> Settings</a>
						{/snippet}
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>

			<div class="mx-auto hidden w-full max-w-md md:block">
				<SearchSlot />
			</div>

			<div class="ml-auto flex items-center gap-1 md:ml-0">
				<SearchSlot compact class="md:hidden" />
				<NextSessionButton {next} class="hidden max-w-64 lg:flex" />
				<NextSessionButton {next} look="icon" class="lg:hidden" />
				<AccountMenu />
			</div>
		</div>
	</header>

	<main class="flex flex-1">
		<div class="min-w-0 flex-1">{@render children()}</div>
		{#if occasion}<SessionPanel {occasion} />{/if}
	</main>

	<footer class="border-t bg-background">
		<div class="mx-auto max-w-6xl px-6 py-1.5"><BuildInfo /></div>
	</footer>
</div>
