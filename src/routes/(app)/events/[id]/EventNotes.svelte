<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDayMonth, formatWeekday } from '$lib/date';
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
		focus,
		editable
	}: {
		eventId: string;
		occurrences: Occurrence[];
		today: string;
		focus: string | null;
		editable: boolean;
	} = $props();

	// "Before school, P6 · S4": every position held on the date, each with its Room if it has one.
	const where = (card: DateCard) =>
		card.positions
			.map((p) => positionLabel(p.position) + (p.room ? ` · ${p.room}` : ''))
			.join(', ');

	// One date at a time, chosen from a strip of every date. It opens on the date a link names, else the
	// next one: a date to plan and a date to log are the same box.
	const cards = $derived(notesByDate(occurrences));
	// svelte-ignore state_referenced_locally
	let picked = $state<string | null>(focus);
	const date = $derived(openDate(cards, today, picked));
	const card = $derived(cards.find((c) => c.date === date));
	const earlier = $derived(date ? earlierNote(cards, date) : null);
	const firstUpcoming = $derived(cards.find((c) => c.date >= today)?.date);

	const chipDay = (iso: string) => formatDayMonth(iso).split(' ');

	// Keep the chosen chip in view when the strip is wider than the screen.
	let strip = $state<HTMLElement>();
	$effect(() => {
		strip?.querySelector('[aria-pressed="true"]')?.scrollIntoView({
			block: 'nearest',
			inline: 'center'
		});
	});
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
		<div
			bind:this={strip}
			class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2"
			role="group"
			aria-label="Dates"
		>
			{#each cards as c (c.date)}
				{@const [day, month] = chipDay(c.date)}
				{#if c.date === firstUpcoming && c.date !== cards[0].date}
					<span aria-hidden="true" class="mx-1 w-px shrink-0 bg-border"></span>
				{/if}
				<button
					type="button"
					aria-pressed={c.date === date}
					aria-label="{formatWeekday(c.date)}{c.note ? ', has a note' : ''}"
					class="flex min-w-16 shrink-0 flex-col items-center rounded-lg border px-3 py-1.5 text-center hover:bg-muted aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
					onclick={() => (picked = c.date)}
				>
					<span class="text-[11px] tracking-wide uppercase opacity-70">{month}</span>
					<span class="text-base font-semibold tabular-nums">{day}</span>
					<span
						class="mt-0.5 size-1.5 rounded-full border-[1.5px] {c.note
							? 'border-current bg-current'
							: 'border-current opacity-50'}"
					></span>
				</button>
			{/each}
		</div>

		{#if card && date}
			<div
				id="date-{date}"
				class="rounded-xl border bg-card p-4 {date === focus ? 'ring-2 ring-primary/40' : ''}"
			>
				{#if !editable}
					<p class="flex flex-wrap items-baseline gap-x-2">
						<span class="text-sm font-semibold">{formatWeekday(date)}</span>
						<span class="text-xs text-muted-foreground">{where(card)}</span>
					</p>
					<p class="mt-2 text-sm whitespace-pre-wrap {card.note ? '' : 'text-muted-foreground'}">
						{card.note ?? 'No note'}
					</p>
				{:else}
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
				{/if}

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
