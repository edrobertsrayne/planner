<!--
	PROTOTYPE — throwaway. Effective-date affordance 2 — "the date is a mode".
	Not a control beside the heading but a bar the grid sits inside, stating in a sentence which
	version of the Timetable is on screen. Costs vertical space and shouts on the ordinary
	start-of-year case; in exchange it is impossible to edit from the wrong date without seeing so,
	and it changes appearance once you leave the default.
-->
<script lang="ts">
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import { CalendarDate, type DateValue } from '@internationalized/date';
	import { fmtLong, YEAR_START } from './fixtures';

	let { from = $bindable(null) }: { from?: string | null } = $props();

	let open = $state(false);
	let picked = $state<DateValue | undefined>(new CalendarDate(2026, 11, 2));
</script>

<div
	class="flex flex-wrap items-center gap-3 rounded-t-xl border border-b-0 px-4 py-2.5 {from
		? 'bg-primary/5 text-foreground'
		: 'bg-muted/40'}"
>
	{#if from}
		<HistoryIcon class="size-4 shrink-0 text-primary" />
		<p class="text-sm">
			Editing the Timetable <span class="font-medium">as it stands from {fmtLong(from)}</span>.
			Sessions before that date are untouched.
		</p>
		<Button variant="ghost" size="sm" class="ml-auto" onclick={() => (from = null)}>
			Back to the whole year
		</Button>
	{:else}
		<PencilIcon class="size-4 shrink-0 text-muted-foreground" />
		<p class="text-sm text-muted-foreground">
			Editing the Timetable for the whole year, from {fmtLong(YEAR_START)}.
		</p>
	{/if}

	<Popover.Root bind:open>
		<Popover.Trigger>
			{#snippet child({ props })}
				<Button {...props} variant="outline" size="sm" class={from ? '' : 'ml-auto'}>
					Change date
				</Button>
			{/snippet}
		</Popover.Trigger>
		<Popover.Content class="w-auto p-0" align="end">
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
					Edit from {picked ? fmtLong(picked.toString()) : '—'}
				</Button>
			</div>
		</Popover.Content>
	</Popover.Root>
</div>
