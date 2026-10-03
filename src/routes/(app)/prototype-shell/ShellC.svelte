<!--
	PROTOTYPE ONLY (issue #305). Variant C: the tabs split into "Teach" (Agenda, Calendar, Classes)
	and "Plan" (Courses, Planning), with the next Session as a pill in the header. On tablet the Plan
	group folds into a menu. On a phone the Teach screens are a segmented control under the title,
	and the next Session is a floating button.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import { toggleMode } from 'mode-watcher';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import BuildInfo from '$lib/components/build-info.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
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

	const TEACH = SCREENS.filter((s) => s.group === 'teach');
	const PLAN = SCREENS.filter((s) => s.group === 'plan');
	const planActive = $derived(PLAN.find((s) => isActive(s.href)));
</script>

{#snippet tab(s: (typeof SCREENS)[number])}
	{@const active = isActive(s.href)}
	<a
		href={s.href}
		class="rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors {active
			? 'bg-muted text-foreground'
			: 'text-muted-foreground hover:text-foreground'}"
		aria-current={active ? 'page' : undefined}>{s.label}</a
	>
{/snippet}

{#snippet groupLabel(text: string)}
	<span class="mr-1 text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase"
		>{text}</span
	>
{/snippet}

<div
	class="flex min-h-screen flex-col bg-background text-foreground [--shell-bottom:0px] [--shell-top:6.25rem] md:[--shell-top:3.5rem]"
>
	<header class="sticky top-0 z-20 border-b bg-background">
		<div class="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 md:px-6">
			<div
				class="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
			>
				<CalendarDaysIcon class="size-4" />
			</div>
			<span class="font-semibold md:hidden">{screenTitle()}</span>

			<nav class="hidden items-center gap-4 md:flex" aria-label="Primary">
				<div class="flex items-center gap-0.5">
					{@render groupLabel('Teach')}
					{#each TEACH as s (s.href)}{@render tab(s)}{/each}
				</div>
				<div class="h-5 w-px bg-border"></div>
				<!-- Laptop: the Plan screens as tabs. -->
				<div class="hidden items-center gap-0.5 lg:flex">
					{@render groupLabel('Plan')}
					{#each PLAN as s (s.href)}{@render tab(s)}{/each}
				</div>
				<!-- Tablet: the Plan screens behind one menu. -->
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium lg:hidden {planActive
							? 'bg-muted text-foreground'
							: 'text-muted-foreground'}"
					>
						{planActive?.label ?? 'Plan'}
						<ChevronDownIcon class="size-3.5" />
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="start">
						{#each PLAN as s (s.href)}
							<DropdownMenu.Item>
								{#snippet child({ props })}
									<a {...props} href={s.href}><s.icon /> {s.label}</a>
								{/snippet}
							</DropdownMenu.Item>
						{/each}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</nav>

			<div class="ml-auto flex items-center gap-1">
				<NextSessionButton {next} class="mr-2 hidden max-w-64 lg:flex" />
				<NextSessionButton {next} look="icon" class="hidden md:inline-flex lg:hidden" />
				<SearchSlot compact />
				<Button
					variant="ghost"
					size="icon"
					href={resolve('/settings')}
					aria-label="Settings"
					class="hidden md:inline-flex"
				>
					<SettingsIcon />
				</Button>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="ghost" size="icon" aria-label="More">
								<EllipsisIcon />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-48">
						<div class="md:hidden">
							{#each PLAN as s (s.href)}
								<DropdownMenu.Item>
									{#snippet child({ props })}
										<a {...props} href={s.href}><s.icon /> {s.label}</a>
									{/snippet}
								</DropdownMenu.Item>
							{/each}
							<DropdownMenu.Item>
								{#snippet child({ props })}
									<a {...props} href={resolve('/settings')}><SettingsIcon /> Settings</a>
								{/snippet}
							</DropdownMenu.Item>
							<DropdownMenu.Separator />
						</div>
						<DropdownMenu.Item onSelect={toggleMode}><MoonIcon /> Toggle theme</DropdownMenu.Item>
						<form method="POST" action="/logout">
							<DropdownMenu.Item>
								{#snippet child({ props })}
									<button {...props} type="submit" class="{props.class} w-full"
										><LogOutIcon /> Log out</button
									>
								{/snippet}
							</DropdownMenu.Item>
						</form>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</div>

		<!-- Phone: the Teach screens as a segmented control. -->
		<nav class="flex gap-1 px-4 pb-2 md:hidden" aria-label="Teach">
			{#each TEACH as s (s.href)}
				{@const active = isActive(s.href)}
				<a
					href={s.href}
					class="flex-1 rounded-md py-1.5 text-center text-sm font-medium {active
						? 'bg-primary text-primary-foreground'
						: 'bg-muted text-muted-foreground'}"
					aria-current={active ? 'page' : undefined}>{s.label}</a
				>
			{/each}
		</nav>
	</header>

	<main class="flex flex-1">
		<div class="min-w-0 flex-1">{@render children()}</div>
		{#if occasion}<SessionPanel {occasion} />{/if}
	</main>

	<footer class="border-t bg-background">
		<div class="mx-auto max-w-6xl px-6 py-1.5"><BuildInfo /></div>
	</footer>

	{#if !occasion}
		<NextSessionButton {next} look="fab" class="fixed right-4 bottom-4 z-20 md:hidden" />
	{/if}
</div>
