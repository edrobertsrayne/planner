<!--
	PROTOTYPE — throwaway. The settled shell from #60 (top tabs, separate header-corner account
	controls). Settings is reached from the header corner, not from a tab, so no tab is active —
	which is itself part of what this ticket is judging.
-->
<script lang="ts">
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import type { Snippet } from 'svelte';
	import AccountLinks from './AccountLinks.svelte';

	let {
		children,
		activeTab = null,
		settingsActive = false,
		onsettings
	}: {
		children: Snippet;
		activeTab?: string | null;
		settingsActive?: boolean;
		onsettings?: () => void;
	} = $props();

	const TABS = ['Agenda', 'Calendar', 'Classes', 'Courses'];
</script>

<div class="flex min-h-screen flex-col bg-background">
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
					<span
						class="-mb-px border-b-2 px-3 py-2 text-sm font-medium {tab === activeTab
							? 'border-foreground text-foreground'
							: 'border-transparent text-muted-foreground'}"
					>
						{tab}
					</span>
				{/each}
			</nav>

			<AccountLinks active={settingsActive} {onsettings} />
		</div>
	</header>

	<main class="min-h-0 flex-1 pb-20">
		{@render children()}
	</main>
</div>
