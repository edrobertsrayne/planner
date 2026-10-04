<!--
	PROTOTYPE ONLY (issue #314). The page around Login and Setup, outside the app shell. `flush`
	drops the muted backdrop and the centring below `sm`: on a phone the form starts at the top, so
	the keyboard does not push it about, and the card frame goes (see `card` below).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import BuildInfo from '$lib/components/build-info.svelte';

	let { flush = false, children }: { flush?: boolean; children: Snippet } = $props();
</script>

<main
	class="flex min-h-svh flex-col items-center gap-6 {flush
		? 'p-4 pt-10 sm:justify-center sm:bg-muted sm:p-6 md:p-10'
		: 'justify-center bg-muted p-6 md:p-10'}"
>
	<div class="flex w-full max-w-sm flex-col gap-6">
		<div class="flex items-center gap-2 self-center font-medium">
			<div
				class="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
			>
				<CalendarDaysIcon class="size-4" />
			</div>
			<span class="text-sm font-semibold tracking-tight">Planner</span>
		</div>
		{@render children()}
		<BuildInfo class="text-center" />
	</div>
</main>
