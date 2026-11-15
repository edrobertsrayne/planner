<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { tick, untrack } from 'svelte';
	import { TIMED_POSITIONS, defaultSchedule, type BellSchedule, type BellTime } from '$lib/bell';
	import {
		generateTeachingWeeks,
		TERM_NAMES,
		type GeneratedTeachingWeek
	} from '$lib/calendar/generate-teaching-weeks';
	import { failureReason } from '$lib/client/enhance';
	import { formatDateShort, isRealDate } from '$lib/date';
	import { positionLabel } from '$lib/events';
	import type { WriteReport } from '$lib/server/planner';
	import RewindReport from '$lib/components/rewind-report.svelte';
	import { Badge, Button, Input } from '$lib/ui';

	// The setup mode's own header carries Save year and Cancel, because the week controls in the
	// page header would read a year that is not saved yet. The Blocked Days below the Terms are
	// not part of that save: adding or removing one applies at once, exactly as blocking a day
	// on the grid does, with its own Rewind and its own report.
	let {
		terms,
		blockedDays,
		schedules,
		onclose
	}: {
		terms: { opens: string; closes: string }[];
		blockedDays: { date: string; note: string | null }[];
		schedules: BellSchedule[];
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

	// Adding and removing a Blocked Day each Rewind, and each names the Placements it moved — a plain statement when the answer is none, because silence would read as an unapplied write.
	// The page data is refreshed without applying the action result, so the report renders here
	// and the grid's own reporting stays exactly as it was. The actions answer with the report
	// and nothing else, so typing it here once reads it without a cast — the same read the save
	// handler makes of ActionData.
	let dayError = $state<string | null>(null);
	let dayReport = $state<WriteReport | null>(null);

	const onDay: SubmitFunction<{ report: WriteReport }, { error: string }> =
		() =>
		async ({ result }) => {
			dayError = null;
			dayReport = null;
			if (result.type === 'success') {
				dayReport = result.data?.report ?? null;
				await invalidateAll();
			} else if (result.type === 'failure') {
				dayError = failureReason(result, 'The Blocked Day was not saved.');
			}
		};

	// A Bell Schedule applies the moment it is saved, as a Blocked Day does, so it is not part of
	// Save year. A new one starts from the default's times, so a school with a split day edits
	// only what differs, and the one made first becomes the default every Class follows.
	type TimeFields = Record<number, BellTime>;
	type ScheduleFields = { name: string; times: TimeFields };

	const timesOf = (schedule?: BellSchedule | null): TimeFields =>
		Object.fromEntries(
			TIMED_POSITIONS.map((position) => [
				position,
				{
					starts: schedule?.times[position]?.starts ?? '',
					ends: schedule?.times[position]?.ends ?? ''
				}
			])
		) as TimeFields;

	// The default is read once, as the starting point: later refreshes must not overwrite what the
	// teacher has already typed into the new row.
	let fresh = $state<ScheduleFields>({
		name: '',
		times: untrack(() => timesOf(defaultSchedule(schedules)))
	});

	// A saved row shows exactly what the seam holds; while typing, this holds the fields the
	// teacher has changed, so another form's refresh on this page does not wipe a half-typed time.
	let typed = $state<Record<string, string>>({});
	const typedValue = (key: string, fallback: string) => typed[key] ?? fallback;
	const remember = (key: string) => (event: Event) => {
		typed[key] = (event.currentTarget as HTMLInputElement).value;
	};
	const forget = (id: string) => {
		for (const key of Object.keys(typed)) if (key.startsWith(`${id}:`)) delete typed[key];
	};

	const NEW_SCHEDULE = 'new';
	let bellError = $state<{ id: string; message: string } | null>(null);

	// Every Bell Schedule form answers the same way: a refusal is named under its own row, and a
	// save refreshes the page so the views that read the times redraw with them. A saved row drops
	// its typed copy, so the server's own values show; the other actions leave it alone.
	function onBell(id: string, saved = false): SubmitFunction {
		return () =>
			async ({ result }) => {
				bellError = null;
				if (result.type === 'success') {
					await invalidateAll();
					await tick();
					if (saved) forget(id);
					if (id === NEW_SCHEDULE) nextSchedule();
				} else if (result.type === 'failure') {
					bellError = {
						id,
						message: failureReason(result, 'The Bell Schedule was not saved.')
					};
				}
			};
	}

	// The first Bell Schedule is the default, so the next one starts from it — but while the load
	// has not caught up, the times just typed are that default already.
	function nextSchedule() {
		const preset = defaultSchedule(schedules);
		fresh = { name: '', times: preset ? timesOf(preset) : fresh.times };
	}

	// The preview updates as the teacher types, before saving, so a mistake costs a retype and
	// not a Rewind. A row still being typed joins in only once both its dates stand — and a date
	// stands only when the canonical check says it is real, so the preview and the save agree on
	// what a date is and an unreal one never reaches the preview. Policing the finished six is
	// the seam's job at save, not this preview's. The generator reads dates alone — a note is
	// for the teacher, not the derivation.
	const weeks: GeneratedTeachingWeek[] = $derived.by(() =>
		generateTeachingWeeks(
			draft.filter((term) => isRealDate(term.opens) && isRealDate(term.closes)),
			blockedDays.map((day) => ({ date: day.date }))
		)
	);
</script>

<div class="flex items-center justify-end gap-2">
	<Button type="button" variant="ghost" size="sm" class="h-7" onclick={onclose}>Cancel</Button>
	<Button type="submit" form="save-year" size="sm" class="h-7">Save year</Button>
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

			<RewindReport
				report={dayReport}
				none="No Placements moved."
				class="mt-2 text-sm text-muted-foreground"
			/>

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

<!-- Bell Schedules apply one at a time, in place, as Blocked Days do: a saved schedule is read
     by every view at once, so it is never held back to Save year. -->
<section class="mt-6" data-bell-schedules>
	<p class="text-sm font-medium">Bell Schedules</p>
	<p class="text-xs text-muted-foreground">
		Each Class follows one Bell Schedule, chosen on the Class page. The default's times are what
		Events and free Periods show; before and after school stay untimed.
		{#if schedules.length === 0}
			The first one added is the default, and every Class follows it.
		{/if}
	</p>

	<div class="mt-3 grid gap-4 md:grid-cols-2">
		{#each schedules as schedule (schedule.id)}
			<div class="min-w-0 rounded-lg border p-3" data-bell-schedule={schedule.id}>
				<form method="POST" action="?/updateBellSchedule" use:enhance={onBell(schedule.id, true)}>
					<input type="hidden" name="id" value={schedule.id} />
					<div class="flex items-center gap-2">
						<Input
							name="name"
							value={typedValue(`${schedule.id}:name`, schedule.name)}
							oninput={remember(`${schedule.id}:name`)}
							aria-label={`${schedule.name} name`}
							class="h-7 min-w-0 flex-1 text-sm"
						/>
						{#if schedule.isDefault}
							<Badge variant="secondary">Default</Badge>
						{/if}
					</div>

					<table class="mt-2 w-full">
						<thead>
							<tr>
								<th class="w-12 pb-1 text-left text-xs font-medium text-muted-foreground">
									<span class="sr-only">Position</span>
								</th>
								<th class="pb-1 text-left text-xs font-medium text-muted-foreground"> Starts </th>
								<th class="pb-1 text-left text-xs font-medium text-muted-foreground"> Ends </th>
							</tr>
						</thead>
						<tbody>
							{#each TIMED_POSITIONS as position (position)}
								{@const label = positionLabel(position)}
								<tr>
									<td class="py-0.5 pr-2 text-sm">{label}</td>
									<td class="py-0.5 pr-1">
										<Input
											type="time"
											name={`starts-${position}`}
											value={typedValue(
												`${schedule.id}:starts-${position}`,
												schedule.times[position]?.starts ?? ''
											)}
											oninput={remember(`${schedule.id}:starts-${position}`)}
											aria-label={`${schedule.name} ${label} start`}
											class="h-7 w-full bg-background text-sm"
										/>
									</td>
									<td class="py-0.5">
										<Input
											type="time"
											name={`ends-${position}`}
											value={typedValue(
												`${schedule.id}:ends-${position}`,
												schedule.times[position]?.ends ?? ''
											)}
											oninput={remember(`${schedule.id}:ends-${position}`)}
											aria-label={`${schedule.name} ${label} end`}
											class="h-7 w-full bg-background text-sm"
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>

					<div class="mt-2 flex justify-end">
						<Button
							type="submit"
							variant="outline"
							size="sm"
							class="h-7"
							aria-label={`Save ${schedule.name}`}
						>
							Save
						</Button>
					</div>
				</form>

				<div class="mt-2 flex items-center gap-2">
					{#if !schedule.isDefault}
						<form
							method="POST"
							action="?/makeDefaultBellSchedule"
							use:enhance={onBell(schedule.id)}
						>
							<input type="hidden" name="id" value={schedule.id} />
							<Button
								type="submit"
								variant="ghost"
								size="xs"
								class="h-6"
								aria-label={`Make ${schedule.name} the default`}
							>
								Make default
							</Button>
						</form>
					{/if}
					<form
						method="POST"
						action="?/deleteBellSchedule"
						use:enhance={onBell(schedule.id)}
						class="ml-auto"
					>
						<input type="hidden" name="id" value={schedule.id} />
						<Button
							type="submit"
							variant="ghost"
							size="xs"
							class="h-6"
							aria-label={`Delete ${schedule.name}`}
						>
							Delete
						</Button>
					</form>
				</div>

				{#if bellError?.id === schedule.id}
					<p role="alert" class="mt-2 text-sm text-destructive">{bellError.message}</p>
				{/if}
			</div>
		{/each}

		<form
			method="POST"
			action="?/createBellSchedule"
			use:enhance={onBell(NEW_SCHEDULE)}
			class="min-w-0 self-start rounded-lg border border-dashed p-3"
			data-new-bell-schedule
		>
			<div class="flex items-center gap-2">
				<Input
					name="name"
					bind:value={fresh.name}
					placeholder="Name — e.g. Years 9–10"
					aria-label="New Bell Schedule name"
					class="h-7 min-w-0 flex-1 text-sm"
				/>
			</div>

			<table class="mt-2 w-full">
				<thead>
					<tr>
						<th class="w-12 pb-1 text-left text-xs font-medium text-muted-foreground">
							<span class="sr-only">Position</span>
						</th>
						<th class="pb-1 text-left text-xs font-medium text-muted-foreground">Starts</th>
						<th class="pb-1 text-left text-xs font-medium text-muted-foreground">Ends</th>
					</tr>
				</thead>
				<tbody>
					{#each TIMED_POSITIONS as position (position)}
						{@const label = positionLabel(position)}
						<tr>
							<td class="py-0.5 pr-2 text-sm">{label}</td>
							<td class="py-0.5 pr-1">
								<Input
									type="time"
									name={`starts-${position}`}
									bind:value={fresh.times[position].starts}
									aria-label={`New Bell Schedule ${label} start`}
									class="h-7 w-full bg-background text-sm"
								/>
							</td>
							<td class="py-0.5">
								<Input
									type="time"
									name={`ends-${position}`}
									bind:value={fresh.times[position].ends}
									aria-label={`New Bell Schedule ${label} end`}
									class="h-7 w-full bg-background text-sm"
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			{#if bellError?.id === NEW_SCHEDULE}
				<p role="alert" class="mt-2 text-sm text-destructive">{bellError.message}</p>
			{/if}

			<div class="mt-2 flex justify-end">
				<Button type="submit" size="sm" class="h-7">Add Bell Schedule</Button>
			</div>
		</form>
	</div>
</section>
