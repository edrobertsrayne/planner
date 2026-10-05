<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { MediaQuery } from 'svelte/reactivity';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import { classTone } from '$lib/class-tone';
	import { replaceQuery } from '$lib/client/enhance';
	import { formatDate } from '$lib/date';
	import { withParam } from '$lib/query';
	import RenameableRow from '$lib/components/renameable-row.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import AssignedTopics from './AssignedTopics.svelte';
	import ClassProgress from './ClassProgress.svelte';
	import TimetableGrid from './TimetableGrid.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// The Timetable reads and writes from a tablet up; on a phone Overview is the only view, so
	// the rename pencil — the page's other edit — follows the Course page's rule.
	const md = new MediaQuery('min-width: 768px', true);
	let tab = $state<'overview' | 'timetable'>('overview');

	// The "Timetable as at" date sets one parameter and keeps the rest, like every filter
	// (withParam, issue #338).
	const setAsAt = (date: string) => replaceQuery(withParam(page.url, 'from', date));

	const tone = $derived(classTone(data.class.tone));
	const slotCount = $derived(data.grid.filter((s) => s.classId === data.class.id).length);

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

	<div class="mt-3 flex items-start gap-3">
		<span
			class="mt-1.5 size-2.5 shrink-0 rounded-full ring-2"
			style:background-color={tone.bg}
			style:--tw-ring-color={tone.ring}
			aria-hidden="true"
		></span>
		<div class="min-w-0">
			<RenameableRow
				name={data.class.label}
				action="?/renameClass"
				hidden={{ id: data.class.id }}
				field="label"
				heading
				editable={md.current}
			/>
			<Badge variant="outline" class="mt-1">{data.class.courseName}</Badge>
		</div>
	</div>

	<!-- Overview and Timetable under the Class's label (story 110). No tabs on a phone: Overview
	     is all a phone reads of this page, whichever tab was last chosen on a wider window. -->
	<Tabs.Root value={tab} onValueChange={(v) => v && (tab = v as typeof tab)} class="mt-3">
		<Tabs.List variant="line" class="max-md:hidden">
			<Tabs.Trigger value="overview">Overview</Tabs.Trigger>
			<Tabs.Trigger value="timetable">
				Timetable <span class="text-xs tabular-nums opacity-60">{slotCount}</span>
			</Tabs.Trigger>
		</Tabs.List>
	</Tabs.Root>

	<!-- Overview always shows on a phone (story 116): the class stays written above. -->
	<div
		class="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] {tab === 'overview'
			? ''
			: 'md:hidden'}"
	>
		<div class="min-w-0">
			{#if data.lane}
				<div class="rounded-xl border p-4">
					<ClassProgress classId={data.class.id} lane={data.lane} />
				</div>
			{/if}
		</div>
		<div class="min-w-0">
			<AssignedTopics
				classId={data.class.id}
				classLabel={data.class.label}
				assigned={data.assignedTopics}
				courseTopics={data.courseTopics}
				atRisk={form?.atRisk}
				placementsMoved={form?.placementsMoved}
			/>
		</div>
	</div>

	<!-- The Timetable from a tablet up only (story 116): hidden below `md`, and unless its tab
	     is on above `md`. -->
	<div class={tab === 'timetable' ? 'max-md:hidden' : 'hidden'}>
		<section class="min-w-0">
			<div class="mt-4 flex flex-wrap items-center gap-2">
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
	</div>
</div>
