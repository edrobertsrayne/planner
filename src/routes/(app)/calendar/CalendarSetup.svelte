<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		generateTeachingWeeks,
		TERM_NAMES,
		type GeneratedTeachingWeek
	} from '$lib/calendar/generate-teaching-weeks';
	import { failureReason } from '$lib/client/enhance';
	import { formatDateShort } from '$lib/date';
	import type { AtRiskSession } from '$lib/server/planner';
	import AtRiskAlert from '$lib/components/at-risk-alert.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	// The setup mode's own header carries Save year and Cancel, because the week controls in the
	// page header would read a year that is not saved yet. The Blocked Days below the Terms are
	// not part of that save: adding or removing one applies at once, exactly as blocking a day
	// on the grid does, with its own Rewind and its own report.
	let {
		terms,
		blockedDays,
		onclose
	}: {
		terms: { opens: string; closes: string }[];
		blockedDays: { date: string; note: string | null }[];
		onclose: () => void;
	} = $props();

	// Six fixed rows in year position — the names are shown, never typed, so a name can never
	// contradict where the Term sits. A row not yet typed carries empty strings.
	let draft = $state(
		TERM_NAMES.map((_, i) => ({
			opens: terms[i]?.opens ?? '',
			closes: terms[i]?.closes ?? ''
		}))
	);

	// A refusal keeps the setup open — the teacher is mid-edit — so the reason shows here, where
	// the dates are, rather than in a toast that outlives the context it belonged to.
	let saveError = $state<string | null>(null);

	const onsave: SubmitFunction =
		() =>
		async ({ result, update }) => {
			if (result.type === 'success') {
				await update({ invalidateAll: true });
				onclose();
			} else if (result.type === 'failure') {
				// The seam wrote the reason for the teacher to read — an unreal date, a Term that
				// opens after it closes, two that touch.
				saveError = failureReason(result, 'The year was not saved.');
			}
		};

	// Adding and removing a Blocked Day each Rewind, and each says what it put at risk — a plain
	// statement when the answer is nothing, because silence would read as an unapplied write.
	// The page data is refreshed without applying the action result, so the report renders here
	// and the grid's own reporting stays exactly as it was.
	let dayError = $state<string | null>(null);
	let dayReport = $state<AtRiskSession[] | null>(null);

	const onDay: SubmitFunction =
		() =>
		async ({ result }) => {
			dayError = null;
			dayReport = null;
			if (result.type === 'success') {
				const raw = (result.data as { atRisk?: unknown } | undefined)?.atRisk;
				dayReport = Array.isArray(raw) ? (raw as AtRiskSession[]) : [];
				await invalidateAll();
			} else if (result.type === 'failure') {
				dayError = failureReason(result, 'The Blocked Day was not saved.');
			}
		};

	// The preview updates as the teacher types, before saving, so a mistake costs a retype and
	// not a Rewind. A row still being typed joins in only once both its dates stand; policing
	// the finished six is the seam's job at save, not this preview's. The generator reads dates
	// alone — a note is for the teacher, not the derivation.
	const weeks: GeneratedTeachingWeek[] = $derived.by(() =>
		generateTeachingWeeks(
			draft.filter(
				(term) => /^\d{4}-\d{2}-\d{2}$/.test(term.opens) && /^\d{4}-\d{2}-\d{2}$/.test(term.closes)
			),
			blockedDays.map((day) => ({ date: day.date }))
		)
	);
</script>

<div class="flex items-center justify-between gap-2">
	<p class="text-sm text-muted-foreground">
		Six Terms, an opening and a closing each. The year they make is listed here before you save.
	</p>
	<div class="flex shrink-0 items-center gap-2">
		<Button type="button" variant="ghost" size="sm" class="h-7" onclick={onclose}>Cancel</Button>
		<Button type="submit" form="save-year" size="sm" class="h-7">Save year</Button>
	</div>
</div>

<div class="mt-4 grid gap-6 lg:grid-cols-2">
	<div class="min-w-0">
		<form id="save-year" method="POST" action="?/saveYear" use:enhance={onsave}>
			{#if saveError}
				<p role="alert" class="mb-3 text-sm text-destructive">{saveError}</p>
			{/if}

			<table class="self-start" data-term-rows>
				<thead>
					<tr>
						<th class="pb-1 text-left text-xs font-medium text-muted-foreground">Term</th>
						<th class="pb-1 text-left text-xs font-medium text-muted-foreground">Opens</th>
						<th class="pb-1 text-left text-xs font-medium text-muted-foreground">Closes</th>
					</tr>
				</thead>
				<tbody>
					{#each draft as term, i (TERM_NAMES[i])}
						<tr>
							<td class="py-1 pr-4 text-sm font-medium">{TERM_NAMES[i]}</td>
							<td class="py-1 pr-2">
								<Input
									type="date"
									name={`opens-${i}`}
									bind:value={term.opens}
									aria-label={`${TERM_NAMES[i]} opening date`}
									class="h-7 w-40 bg-background text-sm"
								/>
							</td>
							<td class="py-1">
								<Input
									type="date"
									name={`closes-${i}`}
									bind:value={term.closes}
									aria-label={`${TERM_NAMES[i]} closing date`}
									class="h-7 w-40 bg-background text-sm"
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</form>

		<section class="mt-6">
			<p class="text-sm font-medium">Blocked Days</p>
			<p class="text-xs text-muted-foreground">
				Every INSET day and bank holiday in the year, added and removed here whatever week it falls
				in.
			</p>

			<form method="POST" action="?/blockDay" use:enhance={onDay} class="mt-2 flex gap-2">
				<Input
					type="date"
					name="date"
					aria-label="Blocked Day date"
					class="h-7 w-40 bg-background text-sm"
				/>
				<Input
					name="note"
					aria-label="Blocked Day note"
					placeholder="Why — optional"
					class="h-7 min-w-0 flex-1 text-sm"
				/>
				<Button type="submit" variant="outline" size="sm" class="h-7">Add day</Button>
			</form>

			{#if dayError}
				<p role="alert" class="mt-2 text-sm text-destructive">{dayError}</p>
			{/if}

			{#if dayReport !== null}
				{#if dayReport.length > 0}
					<div class="mt-2">
						<AtRiskAlert atRisk={dayReport} />
					</div>
				{:else}
					<p role="status" class="mt-2 text-sm text-muted-foreground">
						No Sessions were put at risk.
					</p>
				{/if}
			{/if}

			<ul class="mt-1" data-blocked-days>
				{#each blockedDays as day (day.date)}
					<li class="flex items-center gap-2 border-b py-1.5">
						<span class="text-sm tabular-nums">{formatDateShort(day.date)}</span>
						{#if day.note}
							<span class="min-w-0 truncate text-xs text-muted-foreground">{day.note}</span>
						{/if}
						<form method="POST" action="?/unblockDay" use:enhance={onDay} class="ml-auto">
							<input type="hidden" name="date" value={day.date} />
							<Button
								type="submit"
								variant="ghost"
								size="xs"
								class="h-6"
								aria-label={`Remove Blocked Day ${day.date}`}
							>
								Remove
							</Button>
						</form>
					</li>
				{/each}
			</ul>
			{#if blockedDays.length === 0}
				<p class="py-1.5 text-xs text-muted-foreground">
					None set. Every teaching day in the Terms is open.
				</p>
			{/if}
		</section>
	</div>

	<div class="min-h-0 lg:max-h-[calc(100vh-16rem)] lg:overflow-y-auto" data-week-preview>
		{#if weeks.length === 0}
			<p class="text-sm text-muted-foreground">
				Type an opening and a closing date, and every Teaching Week of the year appears here.
			</p>
		{:else}
			<table class="w-full">
				<thead class="sticky top-0 bg-background">
					<tr>
						<th class="pb-1 text-left text-xs font-medium text-muted-foreground">
							Week commencing
						</th>
						<th class="pb-1 text-left text-xs font-medium text-muted-foreground">Letter</th>
						<th class="pb-1 text-left text-xs font-medium text-muted-foreground">Term</th>
						<th class="pb-1 text-right text-xs font-medium text-muted-foreground">
							Teaching days
						</th>
					</tr>
				</thead>
				<tbody>
					{#each weeks as week (week.weekCommencing)}
						<tr class="border-t">
							<td class="py-1 text-sm tabular-nums">{formatDateShort(week.weekCommencing)}</td>
							<td class="py-1 text-sm font-semibold">Week {week.letter}</td>
							<td class="py-1 text-sm">{week.termName}</td>
							<td class="py-1 text-right text-sm tabular-nums">{week.teachingDays}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</div>
