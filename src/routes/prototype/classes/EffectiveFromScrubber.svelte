<!--
	PROTOTYPE — throwaway. Effective-date affordance 3 — "a position in the year".
	Treats the date not as a setting but as a place you stand: named stops along the academic year,
	plus any date this Class's Slots actually change on, plus a free pick. Argues the honest model
	is "show me the Timetable as at ___" — the same control reads history and writes the future —
	and that the useful dates are few and knowable, so most of the time you never open a calendar.
-->
<script lang="ts">
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import CalendarSearchIcon from '@lucide/svelte/icons/calendar-search';
	import { CalendarDate, type DateValue } from '@internationalized/date';
	import { fmtShort, YEAR_START, DATED_SLOTS, DAYS } from './fixtures';

	let { from = $bindable(null) }: { from?: string | null } = $props();

	let open = $state(false);
	let picked = $state<DateValue | undefined>(new CalendarDate(2026, 11, 2));

	// The dates this Class's Timetable actually changes on — the only dates where "as at" shows
	// anything different. Derived, not typed.
	const changeDates = [
		...new Set(DATED_SLOTS.flatMap((s) => [s.holdsFrom, s.holdsTo].filter(Boolean) as string[]))
	].sort();

	const stops = [
		{ value: null as string | null, label: 'Start of year' },
		{ value: '2026-09-22', label: 'Today' },
		...changeDates.map((d) => ({ value: d, label: fmtShort(d) }))
	];
</script>

<div class="flex flex-wrap items-center gap-2">
	<span class="text-xs text-muted-foreground">Timetable as at</span>
	<div class="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
		{#each stops as stop (stop.label)}
			<button
				type="button"
				onclick={() => (from = stop.value)}
				class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {from === stop.value
					? 'bg-background text-foreground shadow-xs'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				{stop.label}
			</button>
		{/each}
	</div>

	<Popover.Root bind:open>
		<Popover.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="ghost" size="sm" aria-label="Pick another date">
					<CalendarSearchIcon />
					{from && !stops.some((s) => s.value === from) ? fmtShort(from) : 'Another date'}
				</Button>
			{/snippet}
		</Popover.Trigger>
		<Popover.Content class="w-auto p-0" align="start">
			<Calendar type="single" bind:value={picked} locale="en-GB" class="p-2" />
			<div class="border-t p-2">
				<Button
					size="sm"
					class="w-full"
					onclick={() => {
						if (picked) from = picked.toString();
						open = false;
					}}
				>
					Show {picked ? fmtShort(picked.toString()) : '—'}
				</Button>
			</div>
		</Popover.Content>
	</Popover.Root>
</div>

<p class="mt-2 text-xs text-muted-foreground">
	{#if from}
		Editing writes from <span class="font-medium text-foreground">{fmtShort(from)}</span>; earlier
		Sessions keep the Timetable they were derived from.
	{:else}
		Editing writes from <span class="font-medium text-foreground">{fmtShort(YEAR_START)}</span>, the
		start of the year.
	{/if}
	{#if DATED_SLOTS.length}
		This Class has {DATED_SLOTS.length} Slots that only hold part of the year:
		{#each DATED_SLOTS as s, i (s.id)}<span class="text-foreground"
				>{i ? ', ' : ''}Week {s.week} {DAYS[s.day - 1]} P{s.period}</span
			>{/each}.
	{/if}
</p>
