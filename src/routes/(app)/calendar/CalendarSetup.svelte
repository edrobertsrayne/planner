<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		generateTeachingWeeks,
		TERM_NAMES,
		type GeneratedTeachingWeek
	} from '$lib/calendar/generate-teaching-weeks';
	import { failureReason } from '$lib/client/enhance';
	import { formatDateShort } from '$lib/date';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	// The setup mode's own header carries Save year and Cancel, because the week controls in the
	// page header would read a year that is not saved yet.
	let {
		terms,
		blockedDays,
		onclose
	}: {
		terms: { opens: string; closes: string }[];
		blockedDays: { date: string }[];
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

	// The preview updates as the teacher types, before saving, so a mistake costs a retype and
	// not a Rewind. A row still being typed joins in only once both its dates stand; policing
	// the finished six is the seam's job at save, not this preview's.
	const weeks: GeneratedTeachingWeek[] = $derived.by(() =>
		generateTeachingWeeks(
			draft.filter(
				(term) => /^\d{4}-\d{2}-\d{2}$/.test(term.opens) && /^\d{4}-\d{2}-\d{2}$/.test(term.closes)
			),
			blockedDays
		)
	);
</script>

<form method="POST" action="?/saveYear" use:enhance={onsave}>
	{#if saveError}
		<p role="alert" class="mb-3 text-sm text-destructive">{saveError}</p>
	{/if}

	<div class="flex items-center justify-between gap-2">
		<p class="text-sm text-muted-foreground">
			Six Terms, an opening and a closing each. The year they make is listed here before you save.
		</p>
		<div class="flex shrink-0 items-center gap-2">
			<Button type="button" variant="ghost" size="sm" class="h-7" onclick={onclose}>Cancel</Button>
			<Button type="submit" size="sm" class="h-7">Save year</Button>
		</div>
	</div>

	<div class="mt-4 grid gap-6 lg:grid-cols-2">
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
</form>
