<!--
	PROTOTYPE — throwaway. The settled shell from issue #60 (top tabs, separate header-corner
	account controls), minus the Session panel — unlike the schedule prototype's ScheduleShell,
	this one renders *no* Session anywhere. Where the Session goes is exactly what each variant
	is arguing about, so the shell must not pre-answer it.
-->
<script lang="ts">
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import type { Snippet } from 'svelte';
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

	{@render children()}
</div>
