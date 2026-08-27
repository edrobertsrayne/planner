<script lang="ts">
	import { page } from '$app/state';
	import { toggleMode } from 'mode-watcher';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import SunIcon from '@lucide/svelte/icons/sun';
	import PageHeader from '$lib/components/page-header.svelte';
	import BuildInfo from '$lib/components/build-info.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Button } from '$lib/components/ui/button';
	import { Toaster } from '$lib/components/ui/sonner';
	import { selectedOccasion } from '$lib/client/session-panel.svelte';
	import SessionPanel from './SessionPanel.svelte';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	// The panel is open exactly while the URL carries a Session (issue #88), so it survives a
	// reload and Back closes it; the layout renders it once, beside whichever tab is active.
	const occasion = $derived(selectedOccasion());

	const TABS = [
		['/', 'Agenda'],
		['/calendar', 'Calendar'],
		['/classes', 'Classes'],
		['/courses', 'Courses'],
		['/planning', 'Planning']
	] as const;
</script>

<div class="flex min-h-screen flex-col bg-background text-foreground">
	<header class="sticky top-0 z-10 border-b bg-background">
		<div class="mx-auto max-w-6xl px-6">
			<PageHeader class="items-center gap-6 pt-3 pb-0">
				<div class="flex min-w-0 flex-1 items-center gap-6">
					<div class="flex items-center gap-2">
						<div
							class="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
						>
							<CalendarDaysIcon class="size-4" />
						</div>
						<span class="text-sm font-semibold tracking-tight">Planner</span>
					</div>

					<nav class="flex flex-1 gap-1" aria-label="Primary">
						{#each TABS as [href, label] (href)}
							{@const active =
								href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href)}
							<!-- eslint-disable svelte/no-navigation-without-resolve -- static internal route -->
							<a
								{href}
								class="-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors {active
									? 'border-foreground text-foreground'
									: 'border-transparent text-muted-foreground hover:text-foreground'}"
								aria-current={active ? 'page' : undefined}>{label}</a
							>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{/each}
					</nav>
				</div>

				{#snippet actions()}
					{#if data.user}
						<Tooltip.Provider>
							<div class="flex items-center gap-1">
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<Button
												{...props}
												variant="ghost"
												size="icon-sm"
												class="relative"
												onclick={toggleMode}
											>
												<SunIcon
													class="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90"
												/>
												<MoonIcon
													class="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
												/>
												<span class="sr-only">Toggle theme</span>
											</Button>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content>Toggle theme</Tooltip.Content>
								</Tooltip.Root>

								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- static internal route -->
								<Button variant="ghost" size="sm" href="/settings">
									<SettingsIcon data-icon="inline-start" />
									Settings
								</Button>
								<form method="POST" action="/logout">
									<Button variant="ghost" size="sm" type="submit">
										<LogOutIcon data-icon="inline-start" />
										Log out
									</Button>
								</form>
							</div>
						</Tooltip.Provider>
					{/if}
				{/snippet}
			</PageHeader>
		</div>
	</header>

	<main class="flex min-h-0 flex-1">
		<div class="min-w-0 flex-1 overflow-y-auto">
			{@render children()}
		</div>
		{#if occasion}
			<SessionPanel {occasion} />
		{/if}
	</main>

	<footer class="border-t bg-background">
		<div class="mx-auto max-w-6xl px-6 py-1.5">
			<BuildInfo />
		</div>
	</footer>
</div>

<Toaster richColors />
