<!--
	PROTOTYPE — throwaway. Variant B: persistent sidebar (shadcn sidebar-07 shape),
	collapsible to icon rail, user menu pinned in the sidebar footer.

	Honesty note: this shape scales past four destinations without strain — a
	fifth item, or an Agenda/Calendar merge, is just one more SidebarMenuItem.
	It costs more chrome than tabs for a shell this small.
-->
<script lang="ts">
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import UsersIcon from '@lucide/svelte/icons/users';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
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

<Sidebar.Provider class="min-h-0 flex-1">
	<Sidebar.Root collapsible="icon">
		<Sidebar.Header>
			<div class="flex items-center gap-2 px-2 py-1">
				<div
					class="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
				>
					<CalendarDaysIcon class="size-4" />
				</div>
				<span class="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden"
					>Planner</span
				>
			</div>
		</Sidebar.Header>
		<Sidebar.Content>
			<Sidebar.Group>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each NAV as item (item.label)}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton
									isActive={active === item.label}
									onclick={() => (active = item.label)}
									tooltipContent={item.label}
								>
									<item.icon />
									<span>{item.label}</span>
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		</Sidebar.Content>
		<Sidebar.Footer>
			<AccountMenu />
		</Sidebar.Footer>
		<Sidebar.Rail />
	</Sidebar.Root>

	<Sidebar.Inset class="min-h-0">
		<header class="flex h-11 shrink-0 items-center gap-2 border-b px-4">
			<Sidebar.Trigger class="-ml-1" />
			<Separator orientation="vertical" class="mr-2 h-4" />
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
	</Sidebar.Inset>
</Sidebar.Provider>
