<script lang="ts">
	import { enhance } from '$app/forms';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatShortWeekday, formatWeekday } from '$lib/date';
	import { positionLabel } from '$lib/events';
	import { onFail } from '$lib/client/enhance';
	import { earlierNote, notesByDate, openDate, type DateCard } from './notes-by-date';

	type Occurrence = {
		date: string;
		position: number;
		room: string | null;
		note: string | null;
	};

	let {
		eventId,
		occurrences,
		today,
		focus
	}: {
		eventId: string;
		occurrences: Occurrence[];
		today: string;
		focus: string | null;
	} = $props();

	// "Before school, P6 · S4": every position held on the date, each with its Room if it has one.
	const where = (card: DateCard) =>
		card.positions
			.map((p) => positionLabel(p.position) + (p.room ? ` · ${p.room}` : ''))
			.join(', ');

	// One date at a time, however long the run: stepped with the arrows or chosen from the list. It
	// opens on the date a link names, else the next one. A date to plan and a date to log are the
	// same box.
	const cards = $derived(notesByDate(occurrences));
	// svelte-ignore state_referenced_locally
	let picked = $state<string | null>(focus);
	const date = $derived(openDate(cards, today, picked));
	const index = $derived(cards.findIndex((c) => c.date === date));
	const card = $derived(cards[index]);
	const earlier = $derived(date ? earlierNote(cards, date) : null);
	const next = $derived(openDate(cards, today, null));

	// ● where the date has a note, ○ where it has none, so the list shows what is left to write.
	const optionLabel = (c: DateCard) =>
		`${c.note ? '●' : '○'} ${formatShortWeekday(c.date)}${c.date === next ? ' · next' : ''}`;
</script>

<div class="space-y-4">
	<!-- ADR-0001: this is the place a pupil's name is most likely to be typed. -->
	<p class="text-xs text-muted-foreground">
		Write about the group, never a named pupil. One note per date: plan it beforehand, log it
		afterwards.
	</p>

	{#if cards.length === 0}
		<p class="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
			No dates yet. Put this Event on the Timetable and its dates appear here.
		</p>
	{:else}
		<div class="flex items-center gap-2">
			<Button
				variant="outline"
				size="icon"
				aria-label="Earlier date"
				disabled={index <= 0}
				onclick={() => (picked = cards[index - 1].date)}
			>
				<ChevronLeftIcon />
			</Button>
			<select
				aria-label="Date"
				class="h-9 min-w-0 flex-1 rounded-md border bg-transparent px-3 text-sm font-medium"
				value={date}
				onchange={(e) => (picked = e.currentTarget.value)}
			>
				{#each cards as c (c.date)}
					<option value={c.date}>{optionLabel(c)}</option>
				{/each}
			</select>
			<Button
				variant="outline"
				size="icon"
				aria-label="Later date"
				disabled={index >= cards.length - 1}
				onclick={() => (picked = cards[index + 1].date)}
			>
				<ChevronRightIcon />
			</Button>
			<Button variant="outline" disabled={date === next} onclick={() => (picked = next)}>
				Today
			</Button>
		</div>

		{#if card && date}
			<div id="date-{date}" class="rounded-xl border bg-card p-4">
				<form
					method="POST"
					action="?/setEventNote"
					use:enhance={onFail('Could not save the note.')}
				>
					<input type="hidden" name="eventId" value={eventId} />
					<input type="hidden" name="date" value={date} />
					<label class="block">
						<span class="flex flex-wrap items-baseline gap-x-2">
							<span class="text-sm font-semibold">{formatWeekday(date)}</span>
							<span class="text-xs text-muted-foreground">{where(card)}</span>
						</span>
						{#key date}
							<textarea
								name="note"
								rows="7"
								value={card.note ?? ''}
								placeholder={date >= today ? 'Plan this date' : 'Log this date'}
								class="mt-2 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm"
								onchange={(e) => e.currentTarget.form?.requestSubmit()}></textarea>
						{/key}
					</label>
				</form>

				{#if earlier}
					<p class="mt-3 border-l-2 pl-3 text-sm text-muted-foreground">
						<span class="font-medium text-foreground">{formatWeekday(earlier.date)}:</span>
						<span class="whitespace-pre-wrap">{earlier.note}</span>
					</p>
				{/if}
			</div>
		{/if}
	{/if}
</div>
