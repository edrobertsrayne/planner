<!--
	PROTOTYPE — throwaway. The shell around each schedule variant, carried over from the winning
	shape in the shell prototype (issue #60): top tabs, separate header-corner account links, the
	main content as a flex sibling of the Session panel. Tab count is the variable each variant
	plays with — two destinations (Agenda, Calendar) or one merged "Schedule" tab.
-->
<script lang="ts">
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import type { Snippet } from 'svelte';
	import { sessionPanel } from '$lib/client/session-panel.svelte';
	import SessionPanel from '../../SessionPanel.svelte';
	import AccountLinks from './AccountLinks.svelte';

	let {
		tabs,
		active,
		onSelect,
		children
	}: { tabs: string[]; active: string; onSelect?: (tab: string) => void; children: Snippet } =
		$props();
</script>

<div class="flex h-full min-h-0 flex-col bg-background">
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
				{#each tabs as tab (tab)}
					<button
						type="button"
						disabled={!onSelect}
						onclick={() => onSelect?.(tab)}
						class="-mb-px border-b-2 px-3 py-2 text-sm font-medium {tab === active
							? 'border-foreground text-foreground'
							: 'border-transparent text-muted-foreground'} {onSelect
							? 'hover:text-foreground'
							: ''}"
					>
						{tab}
					</button>
				{/each}
			</nav>

			<AccountLinks />
		</div>
	</header>

	<main class="flex min-h-0 flex-1">
		<div class="min-w-0 flex-1 overflow-y-auto px-6 py-6">
			{@render children()}
		</div>
		{#if sessionPanel.selected}
			<SessionPanel occasion={sessionPanel.selected} onclose={() => sessionPanel.close()} />
		{/if}
	</main>
</div>
