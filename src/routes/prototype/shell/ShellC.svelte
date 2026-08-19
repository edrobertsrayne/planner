<!--
	PROTOTYPE — throwaway. Variant C: always-collapsed icon rail, no expand state.
	Maximises content width; account actions pinned at the bottom of the rail.

	Honesty note: icons-only strains past ~5 destinations (no room for labels
	without a tooltip-only guessing game) and doesn't leave an obvious place
	for Agenda/Calendar to merge into a single item with sub-tabs — that would
	need a second-level strip under the top bar, not shown here.
-->
<script lang="ts">
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import UsersIcon from '@lucide/svelte/icons/users';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import AccountMenu from './AccountMenu.svelte';
	import MockSessionPanel from './MockSessionPanel.svelte';
	import PlaceholderContent from './PlaceholderContent.svelte';

	const NAV = [
		{ label: 'Agenda', icon: InboxIcon },
		{ label: 'Calendar', icon: CalendarIcon },
		{ label: 'Classes', icon: UsersIcon },
		{ label: 'Courses', icon: BookOpenIcon }
	];
	let active = $state('Agenda');
	let showSession = $state(true);
</script>

<div class="flex h-full min-h-0">
	<Tooltip.Provider delayDuration={200}>
		<nav class="flex w-14 shrink-0 flex-col items-center border-r bg-sidebar py-3">
			<div
				class="mb-4 flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground"
			>
				<CalendarDaysIcon class="size-4" />
			</div>

			<div class="flex flex-1 flex-col gap-1">
				{#each NAV as item (item.label)}
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<Button
									{...props}
									variant={active === item.label ? 'secondary' : 'ghost'}
									size="icon"
									class="size-9"
									onclick={() => (active = item.label)}
								>
									<item.icon class="size-4.5" />
								</Button>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="right">{item.label}</Tooltip.Content>
					</Tooltip.Root>
				{/each}
			</div>

			<AccountMenu variant="compact" />
		</nav>
	</Tooltip.Provider>

	<div class="flex min-h-0 flex-1 flex-col">
		<header class="flex h-11 shrink-0 items-center border-b px-6">
			<h1 class="text-sm font-medium">{active}</h1>
		</header>
		<main class="flex min-h-0 flex-1">
			<div class="min-w-0 flex-1 overflow-y-auto px-6 py-6">
				<PlaceholderContent title={active} showActions={false} />
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
</div>
