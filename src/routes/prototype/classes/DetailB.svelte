<!--
	PROTOTYPE — throwaway. Class page variant B — "identity, then two jobs behind tabs".
	Splits the page: one header owns the Class and its lane, and the two editing jobs — Timetable
	and Topics — become tabs beneath it. Argues that timetabling and sequencing are done on
	different days, months apart, and putting both on screen makes each look like part of the other.
	The cost is that the Runway (a Topics fact) and the Slots that carry it are never seen together.
-->
<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import SlotGridUnified from './SlotGridUnified.svelte';
	import EffectiveFromBanner from './EffectiveFromBanner.svelte';
	import TopicsQueue from './TopicsQueue.svelte';
	import { SUBJECT, DATED_SLOTS, DAYS, GRID, fmtLong } from './fixtures';

	let from = $state<string | null>(null);

	const mySlots = GRID.filter((s) => s.classId === SUBJECT.classId).length;
</script>

<Tabs.Root value="timetable">
	<div class="border-b bg-card">
		<div class="mx-auto max-w-4xl px-6 pt-5">
			<a
				href="##"
				class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
			>
				<ChevronLeftIcon class="size-3" />Classes
			</a>

			<div class="mt-1 flex flex-wrap items-center gap-3">
				<h1 class="text-xl font-semibold tracking-tight">{SUBJECT.classLabel}</h1>
				<Badge variant="outline">{SUBJECT.courseName}</Badge>
				<div class="ml-auto flex items-center gap-3">
					<span class="text-xs text-muted-foreground tabular-nums">
						{SUBJECT.taught} / {SUBJECT.total} Lessons taught
					</span>
					<Progress value={SUBJECT.taught} max={SUBJECT.total} class="h-1 w-28" />
				</div>
			</div>

			<p class="mt-1 text-xs text-muted-foreground">
				Next up <span class="font-medium text-foreground">{SUBJECT.nextUp?.title}</span> · Runway
				<span class="font-medium text-foreground">
					{SUBJECT.runway.date ? fmtLong(SUBJECT.runway.date) : 'open-ended'}
				</span>
			</p>

			<Tabs.List variant="line" class="mt-4 h-9 justify-start">
				<Tabs.Trigger value="timetable" class="flex-none px-3">
					Timetable
					<span class="ml-1 text-xs text-muted-foreground tabular-nums">{mySlots}</span>
				</Tabs.Trigger>
				<Tabs.Trigger value="topics" class="flex-none px-3">
					Topics
					<span class="ml-1 text-xs text-muted-foreground tabular-nums">5</span>
				</Tabs.Trigger>
			</Tabs.List>
		</div>
	</div>

	<!-- `w-full` matters: this is a flex child of Tabs.Root, and `mx-auto` alone shrinks it to fit. -->
	<div class="mx-auto w-full max-w-4xl px-6 py-6">
		<Tabs.Content value="timetable">
			<EffectiveFromBanner bind:from />
			<div class="rounded-b-xl border p-4">
				<SlotGridUnified />
				<p class="mt-3 text-xs text-muted-foreground">
					Greyed Periods belong to another Class. A double is two Periods, ticked separately.
				</p>
				{#if DATED_SLOTS.length}
					<p class="mt-2 text-xs text-muted-foreground">
						{DATED_SLOTS.length} Slots do not hold all year:
						{#each DATED_SLOTS as s, i (s.id)}<span class="text-foreground"
								>{i ? '; ' : ''}Week {s.week} {DAYS[s.day - 1]} P{s.period}</span
							>
							{#if s.holdsFrom}from {fmtLong(s.holdsFrom)}{/if}{#if s.holdsTo}{s.holdsFrom
									? ', '
									: ''}until {fmtLong(s.holdsTo)}{/if}{/each}.
					</p>
				{/if}
			</div>
		</Tabs.Content>

		<Tabs.Content value="topics">
			<p class="mb-3 text-sm text-muted-foreground">
				{SUBJECT.classLabel} teaches these, in this order — decide the next one as you reach it.
			</p>
			<TopicsQueue />
		</Tabs.Content>
	</div>
</Tabs.Root>
