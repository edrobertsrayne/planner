<!--
	PROTOTYPE — throwaway. Effective-date affordance 1 — "a control in the section header".
	Closest to today: the date is a setting sitting beside the Timetable heading, expressed as one
	button whose label states the current answer in full, opening a Popover holding the two real
	choices. Compact, and easy to miss — which is the thing to judge, because every click in the
	grid below silently obeys it.
-->
<script lang="ts">
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import { CalendarDate, type DateValue } from '@internationalized/date';
	import { fmtLong, YEAR_START } from './fixtures';

	let { from = $bindable(null) }: { from?: string | null } = $props();

	let open = $state(false);
	let picked = $state<DateValue | undefined>(new CalendarDate(2026, 11, 2));

	function pickDate() {
		if (!picked) return;
		from = picked.toString();
		open = false;
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" size="sm">
				<CalendarIcon />
				Changes apply from {from ? fmtLong(from) : 'the start of the year'}
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-80 p-0" align="end">
		<div class="p-3">
			<p class="text-sm font-medium">Changes apply from</p>
			<p class="mt-1 text-xs text-muted-foreground">
				Slots hold between dates. Editing from a later date ends the old Slot there and starts the
				new one, leaving everything already taught alone.
			</p>
			<Button
				variant={from ? 'ghost' : 'secondary'}
				size="sm"
				class="mt-2 w-full justify-start"
				onclick={() => {
					from = null;
					open = false;
				}}
			>
				The start of the year — {fmtLong(YEAR_START)}
			</Button>
		</div>
		<Separator />
		<Calendar type="single" bind:value={picked} locale="en-GB" class="p-2" />
		<Separator />
		<div class="p-2">
			<Button size="sm" class="w-full" onclick={pickDate}>
				Apply from {picked ? fmtLong(picked.toString()) : '—'}
			</Button>
		</div>
	</Popover.Content>
</Popover.Root>
