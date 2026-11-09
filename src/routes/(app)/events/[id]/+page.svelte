<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { MediaQuery } from 'svelte/reactivity';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { useBack } from '$lib/client/back';
	import { createDeleteAsk } from '$lib/client/confirm-delete.svelte';
	import { replaceQuery } from '$lib/client/enhance';
	import { formatDate } from '$lib/date';
	import { kindLabel, positionLabel } from '$lib/events';
	import { withParam } from '$lib/query';
	import ConfirmDeleteDialog from '$lib/components/confirm-delete-dialog.svelte';
	import RenameableRow from '$lib/components/renameable-row.svelte';
	import { Badge, Button, Select } from '$lib/ui';
	import * as Tabs from '$lib/ui/tabs';
	import EventNotes from './EventNotes.svelte';
	import EventRooms from './EventRooms.svelte';
	import EventTimetableGrid from './EventTimetableGrid.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Notes are read and written on any screen; the Timetable is a tablet-up screen, as on
	// the Class page.
	const md = new MediaQuery('min-width: 768px', true);
	// The tab is chosen when the page opens (an Event with no Slot opens on its Timetable) and then
	// only by the teacher: placing the first Slot must not move them off the grid.
	// svelte-ignore state_referenced_locally
	let picked = $state<'notes' | 'timetable'>(data.tab);
	const tab = $derived(md.current ? picked : 'notes');
	const setTab = (value: string) => (picked = value === 'timetable' ? 'timetable' : 'notes');
	const setAsAt = (date: string) => replaceQuery(withParam(page.url, 'from', date));

	const back = useBack(() => resolve('/events'));
	const deleter = createDeleteAsk(() => ({ id: data.event.id, name: data.event.name }));

	const labelOf = (classId: string) => data.classes.find((c) => c.id === classId)?.label ?? classId;
	const slotCount = $derived(data.eventSlots.filter((s) => s.eventId === data.event.id).length);
	const isPast = $derived(data.on < data.today);

	// Named stops, as on the Class page: start of year, today, and every date this Event's own
	// Slots start or stop holding.
	const asAtOptions = $derived.by(() => {
		const dates = [data.today, data.yearStart, data.on];
		for (const s of data.datedSlots) dates.push(s.holdsFrom, s.holdsTo);
		const unique = dates.filter((d, i): d is string => d !== null && dates.indexOf(d) === i);
		return unique.sort().map((date) => ({
			value: date,
			label:
				date === data.yearStart
					? `Start of year — ${formatDate(date)}`
					: date === data.today
						? `Today — ${formatDate(date)}`
						: formatDate(date)
		}));
	});

	const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
</script>

<svelte:head><title>{data.event.name}</title></svelte:head>

<div class="mx-auto max-w-6xl px-6 py-6">
	<Button variant="ghost" size="sm" class="-ml-3" onclick={back}>
		<ArrowLeftIcon data-icon="inline-start" />
		Back
	</Button>

	{#if form?.error}
		<p role="alert" class="mt-3 text-xs text-destructive">{form.error}</p>
	{/if}

	<div class="mt-3 flex items-start gap-3">
		<div class="min-w-0">
			<RenameableRow
				name={data.event.name}
				action="?/renameEvent"
				hidden={{ id: data.event.id }}
				field="name"
				editable={md.current}
			/>
			<Badge variant="outline" class="mt-1">{kindLabel(data.event.kind)}</Badge>
		</div>
		{#if md.current}
			<form method="POST" action="?/deleteEvent" use:enhance={deleter.ask} class="ml-auto shrink-0">
				<input type="hidden" name="id" value={data.event.id} />
				<Button
					type="submit"
					variant="ghost"
					size="sm"
					class="text-destructive hover:text-destructive"
				>
					<TrashIcon data-icon="inline-start" />
					Delete Event
				</Button>
			</form>
		{/if}
	</div>

	<Tabs.Root value={tab} onValueChange={(v) => v && setTab(v)} class="mt-3">
		<Tabs.List class="max-md:hidden">
			<Tabs.Trigger value="notes">Notes</Tabs.Trigger>
			<Tabs.Trigger value="timetable">
				Timetable <span class="text-xs tabular-nums opacity-60">{slotCount}</span>
			</Tabs.Trigger>
		</Tabs.List>
	</Tabs.Root>

	{#if tab === 'notes'}
		<div class="mt-4">
			<EventNotes
				eventId={data.event.id}
				occurrences={data.occurrences}
				today={data.today}
				focus={data.date}
			/>
		</div>
	{:else}
		<section class="min-w-0">
			<div class="mt-4 flex flex-wrap items-center gap-2">
				<span class="text-xs font-medium text-muted-foreground">Timetable as at</span>
				<Select
					value={data.on}
					onValueChange={setAsAt}
					options={asAtOptions}
					aria-label="Date"
					class="w-56 text-xs"
				/>
				<input
					type="date"
					class="h-7 rounded-md border bg-transparent px-2 text-xs"
					value={data.on}
					onchange={(e) => setAsAt(e.currentTarget.value)}
					aria-label="Timetable as at — pick any date"
				/>
				{#if isPast}
					<Badge variant="outline" class="text-muted-foreground">Read-only — past</Badge>
				{/if}
			</div>

			<div class="mt-3 rounded-xl border p-4">
				<EventTimetableGrid
					eventId={data.event.id}
					eventName={data.event.name}
					on={data.on}
					readOnly={isPast}
					classSlots={data.classSlots}
					eventSlots={data.eventSlots}
					{labelOf}
				/>

				<p class="mt-3 text-xs text-muted-foreground">
					A position held by a Class or another Event is hatched and carries its name. Before school
					and After school belong to Events alone.
				</p>

				<EventRooms eventId={data.event.id} readOnly={isPast} slots={data.eventSlots} />

				{#if data.datedSlots.length}
					<div class="mt-4 rounded-lg bg-muted/40 px-3 py-2">
						<p class="text-xs font-medium">Slots that do not hold all year</p>
						<ul class="mt-1 space-y-0.5 text-xs text-muted-foreground">
							{#each data.datedSlots as s (s.id)}
								<li>
									<span class="font-medium text-foreground">
										Week {s.week} · {DAY_NAMES[s.day - 1]} · {positionLabel(s.position)}
									</span>
									{#if s.holdsFrom}from {formatDate(s.holdsFrom)}{/if}
									{#if s.holdsTo}{s.holdsFrom ? ', ' : ''}until {formatDate(s.holdsTo)}{/if}
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		</section>
	{/if}
</div>

<ConfirmDeleteDialog bind:target={deleter.pending} />
