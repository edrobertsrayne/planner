<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatWeekday } from '$lib/date';
	import { positionLabel } from '$lib/events';
	import { onFail } from '$lib/client/enhance';

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

	// Coming up first, soonest at the top, then the dates already gone, latest first: a date to plan
	// and a date to log are the same box.
	const upcoming = $derived(occurrences.filter((o) => o.date >= today));
	const earlier = $derived(occurrences.filter((o) => o.date < today).reverse());
</script>

{#snippet dateCard(o: Occurrence)}
	<li
		id="date-{o.date}"
		class="rounded-xl border bg-card p-4 {o.date === focus ? 'ring-2 ring-primary/40' : ''}"
	>
		{#if !editable}
			<p class="flex flex-wrap items-baseline gap-x-2">
				<span class="text-sm font-semibold">{formatWeekday(o.date)}</span>
				<span class="text-xs text-muted-foreground">
					{positionLabel(o.position)}{o.room ? ` · ${o.room}` : ''}
				</span>
			</p>
			<p class="mt-2 text-sm whitespace-pre-wrap {o.note ? '' : 'text-muted-foreground'}">
				{o.note ?? 'No note'}
			</p>
		{:else}
			<form method="POST" action="?/setEventNote" use:enhance={onFail('Could not save the note.')}>
				<input type="hidden" name="eventId" value={eventId} />
				<input type="hidden" name="date" value={o.date} />
				<label class="block">
					<span class="flex flex-wrap items-baseline gap-x-2">
						<span class="text-sm font-semibold">{formatWeekday(o.date)}</span>
						<span class="text-xs text-muted-foreground">
							{positionLabel(o.position)}{o.room ? ` · ${o.room}` : ''}
						</span>
					</span>
					<textarea
						name="note"
						rows="3"
						value={o.note ?? ''}
						placeholder={o.date >= today ? 'Plan this date' : 'Log this date'}
						class="mt-2 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm"
						onchange={(e) => e.currentTarget.form?.requestSubmit()}></textarea>
				</label>
			</form>
		{/if}
	</li>
{/snippet}

<div class="space-y-6">
	<!-- ADR-0001: this is the place a pupil's name is most likely to be typed. -->
	<p class="text-xs text-muted-foreground">
		Write about the group, never a named pupil. One note per date: plan it beforehand, log it
		afterwards.
	</p>

	{#if occurrences.length === 0}
		<p class="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
			No dates yet. Put this Event on the Timetable and its dates appear here.
		</p>
	{/if}

	{#if upcoming.length}
		<section>
			<h2 class="mb-2 text-sm font-semibold">Coming up</h2>
			<ul class="grid gap-3 md:grid-cols-2">
				{#each upcoming as o (o.date)}{@render dateCard(o)}{/each}
			</ul>
		</section>
	{/if}

	{#if earlier.length}
		<section>
			<h2 class="mb-2 text-sm font-semibold">Earlier</h2>
			<ul class="grid gap-3 md:grid-cols-2">
				{#each earlier as o (o.date)}{@render dateCard(o)}{/each}
			</ul>
		</section>
	{/if}
</div>
