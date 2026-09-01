<script lang="ts">
	import { resolve } from '$app/paths';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import { replaceQuery } from '$lib/client/enhance';
	import { formatDate } from '$lib/date';
	import RenameableRow from '$lib/components/renameable-row.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import AssignedTopics from './AssignedTopics.svelte';
	import ClassProgress from './ClassProgress.svelte';
	import TimetableGrid from './TimetableGrid.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const setAsAt = (date: string) => replaceQuery(`?from=${date}`);

	const labelOf = (classId: string) => data.classes.find((c) => c.id === classId)?.label ?? classId;

	// Named stops: start of year, today, and every date this Class's own Slots start or stop
	// holding — the "Timetable as at" control's job is to make those, plus any date at all, a
	// first-class position to view or edit from (issue #93).
	const stops = $derived.by(() => {
		const dates = [data.today, data.yearStart];
		for (const s of data.datedSlots) dates.push(s.holdsFrom, s.holdsTo);
		const unique = dates.filter((d, i): d is string => d !== null && dates.indexOf(d) === i);
		return unique.sort().map((date) => ({
			date,
			label:
				date === data.yearStart
					? `Start of year — ${formatDate(date)}`
					: date === data.today
						? `Today — ${formatDate(date)}`
						: formatDate(date)
		}));
	});

	// A date before today shows what was taught, and is never editable (ADR-0006, amended).
	const isPast = $derived(data.on < data.today);

	const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
</script>

<svelte:head><title>{data.class.label}</title></svelte:head>

<div class="mx-auto max-w-6xl px-6 py-6">
	<a
		href={resolve('/classes')}
		class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
	>
		<ChevronLeftIcon class="size-3" />Classes
	</a>

	{#if form?.error}
		<p role="alert" class="mt-3 text-xs text-destructive">{form.error}</p>
	{/if}

	<div class="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
		<section class="min-w-0">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<h2 class="text-sm font-semibold">Timetable</h2>
				<span class="text-xs text-muted-foreground tabular-nums">
					{data.grid.filter((s) => s.classId === data.class.id).length} Slots a fortnight
				</span>
			</div>

			<div class="mt-2 flex flex-wrap items-center gap-2">
				<span class="text-xs font-medium text-muted-foreground">Timetable as at</span>
				<Select.Root type="single" value={data.on} onValueChange={(v) => v && setAsAt(v)}>
					<Select.Trigger size="sm" class="h-7 w-56 text-xs">
						{formatDate(data.on)}
					</Select.Trigger>
					<Select.Content>
						{#each stops as s (s.date)}
							<Select.Item value={s.date} label={s.label} />
						{/each}
					</Select.Content>
				</Select.Root>
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
				<TimetableGrid
					classId={data.class.id}
					classLabel={data.class.label}
					on={data.on}
					readOnly={isPast}
					slots={data.grid}
					{labelOf}
				/>

				<p class="mt-3 text-xs text-muted-foreground">
					A Period held by another Class carries its label. A double is two Periods, ticked
					separately.
				</p>

				{#if data.datedSlots.length}
					<div class="mt-4 rounded-lg bg-muted/40 px-3 py-2">
						<p class="text-xs font-medium">Slots that do not hold all year</p>
						<ul class="mt-1 space-y-0.5 text-xs text-muted-foreground">
							{#each data.datedSlots as s (s.id)}
								<li>
									<span class="font-medium text-foreground">
										Week {s.week} · {DAY_NAMES[s.day - 1]} · P{s.period}
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

		<aside class="space-y-5 lg:sticky lg:top-6 lg:self-start">
			<div>
				<RenameableRow
					name={data.class.label}
					action="?/renameClass"
					hidden={{ id: data.class.id }}
					field="label"
					heading
				/>
				<Badge variant="outline" class="mt-1">{data.class.courseName}</Badge>
				<p class="mt-2 text-xs text-muted-foreground">
					The Course is fixed at creation — a mis-pick means deleting the Class and starting again.
				</p>
			</div>

			{#if data.lane}
				<ClassProgress classId={data.class.id} lane={data.lane} />
				<Separator />
			{/if}

			<AssignedTopics
				classId={data.class.id}
				classLabel={data.class.label}
				assigned={data.assignedTopics}
				courseTopics={data.courseTopics}
				atRisk={form?.atRisk}
			/>
		</aside>
	</div>
</div>
