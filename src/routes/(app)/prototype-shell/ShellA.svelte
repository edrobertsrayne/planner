<!--
	PROTOTYPE ONLY (issue #305). Variant A: top tabs on laptop and tablet; a bottom tab bar on a phone.
	Closest to today. Settings, theme and Log out move into one account menu.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import BuildInfo from '$lib/components/build-info.svelte';
	import * as Sheet from '$lib/components/ui/sheet';
	import type { Occasion } from '$lib/client/session-panel.svelte';
	import SessionPanel from '../SessionPanel.svelte';
	import AccountMenu from './AccountMenu.svelte';
	import NextSessionButton from './NextSessionButton.svelte';
	import SearchSlot from './SearchSlot.svelte';
	import { SCREENS, isActive, screenTitle, type NextSession } from './nav';

	let {
		children,
		occasion,
		next
	}: { children: Snippet; occasion: Occasion | null; next: NextSession | null } = $props();

	let more = $state(false);
	const PHONE_TABS = SCREENS.filter((s) => s.group === 'teach');
	const MORE = SCREENS.filter((s) => s.group === 'plan');
	const moreActive = $derived(MORE.some((s) => isActive(s.href)) || isActive(resolve('/settings')));
</script>

<div
	class="flex min-h-screen flex-col bg-background text-foreground [--shell-bottom:4rem] [--shell-top:3.5rem] md:[--shell-bottom:0px]"
>
	<header class="sticky top-0 z-20 h-14 border-b bg-background">
		<div class="mx-auto flex h-full max-w-6xl items-center gap-4 px-4 md:px-6">
			<div
				class="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
			>
				<CalendarDaysIcon class="size-4" />
			</div>
			<span class="font-semibold md:hidden">{screenTitle()}</span>

			<nav class="hidden h-full items-stretch gap-1 md:flex" aria-label="Primary">
				{#each SCREENS as s (s.href)}
					{@const active = isActive(s.href)}
					<a
						href={s.href}
						class="-mb-px flex items-center border-b-2 px-3 text-sm font-medium transition-colors {active
							? 'border-foreground text-foreground'
							: 'border-transparent text-muted-foreground hover:text-foreground'}"
						aria-current={active ? 'page' : undefined}>{s.label}</a
					>
				{/each}
			</nav>

			<div class="ml-auto flex items-center gap-1">
				<SearchSlot class="hidden w-56 lg:flex" />
				<SearchSlot compact class="lg:hidden" />
				<AccountMenu />
			</div>
		</div>
	</header>

	<main class="flex flex-1">
		<div class="min-w-0 flex-1">{@render children()}</div>
		{#if occasion}<SessionPanel {occasion} />{/if}
	</main>

	<footer class="border-t bg-background pb-16 md:pb-0">
		<div class="mx-auto max-w-6xl px-6 py-1.5"><BuildInfo /></div>
	</footer>

	<!-- Phone only: the teaching screens one tap away, the rest under More. -->
	<nav
		class="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t bg-background md:hidden"
		aria-label="Primary"
	>
		{#each PHONE_TABS as s (s.href)}
			{@const active = isActive(s.href)}
			<a
				href={s.href}
				class="flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium {active
					? 'text-foreground'
					: 'text-muted-foreground'}"
				aria-current={active ? 'page' : undefined}
			>
				<s.icon class="size-5" />
				{s.label}
			</a>
		{/each}
		<NextSessionButton {next} look="tab" />
		<Sheet.Root bind:open={more}>
			<Sheet.Trigger
				class="flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium {moreActive
					? 'text-foreground'
					: 'text-muted-foreground'}"
			>
				<EllipsisIcon class="size-5" />
				More
			</Sheet.Trigger>
			<Sheet.Content side="bottom" class="pb-6">
				<Sheet.Header><Sheet.Title>More</Sheet.Title></Sheet.Header>
				<div class="flex flex-col px-2">
					{#each MORE as s (s.href)}
						<a
							href={s.href}
							onclick={() => (more = false)}
							class="flex items-center gap-3 rounded-md px-3 py-3 text-base hover:bg-muted"
						>
							<s.icon class="size-5" />
							{s.label}
						</a>
					{/each}
					<a
						href={resolve('/settings')}
						onclick={() => (more = false)}
						class="flex items-center gap-3 rounded-md px-3 py-3 text-base hover:bg-muted"
					>
						<SettingsIcon class="size-5" /> Settings
					</a>
				</div>
			</Sheet.Content>
		</Sheet.Root>
	</nav>
</div>
