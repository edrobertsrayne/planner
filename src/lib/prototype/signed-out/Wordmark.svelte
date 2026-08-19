<!-- PROTOTYPE — the wordmark lockup both variants share, following the block's icon-tile pattern. -->
<script lang="ts">
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';

	let { stacked = false }: { stacked?: boolean } = $props();
</script>

{#if stacked}
	<div class="flex size-8 items-center justify-center">
		<CalendarDaysIcon class="size-6" />
	</div>
{:else}
	<span class="flex items-center gap-2 self-center font-medium">
		<span
			class="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
		>
			<CalendarDaysIcon class="size-4" />
		</span>
		Planner
	</span>
{/if}
