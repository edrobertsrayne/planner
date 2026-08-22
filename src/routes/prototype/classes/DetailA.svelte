<!--
	PROTOTYPE — throwaway. Class page variant A — "one page, sectioned".
	Keeps today's answer to the split question: one screen doing all three jobs, separated into
	Cards you scroll past. Identity at the top, the lane as a strip beneath it, then Timetable, then
	Assigned Topics. Argues that CONTEXT.md is right that the Class page is a single surface, and
	that the fix is styling and rhythm rather than division.
-->
<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import PageHeader from './PageHeader.svelte';
	import SlotGridPair from './SlotGridPair.svelte';
	import EffectiveFromPopover from './EffectiveFromPopover.svelte';
	import TopicsGrid from './TopicsGrid.svelte';
	import { SUBJECT, DATED_SLOTS, DAYS, fmtLong } from './fixtures';

	let from = $state<string | null>(null);
</script>

<div class="mx-auto max-w-4xl px-6 py-6">
	<PageHeader description="Teaches the Topics below, in order, in the Slots below that.">
		{#snippet back()}
			<a
				href="##"
				class="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
			>
				<ChevronLeftIcon class="size-3" />Classes
			</a>
		{/snippet}
		<div class="flex flex-wrap items-center gap-2">
			<h1 class="text-lg font-semibold tracking-tight">{SUBJECT.classLabel}</h1>
			<Badge variant="outline">{SUBJECT.courseName}</Badge>
		</div>
	</PageHeader>

	<!-- The lane: the same facts as the Classes list row, restated here as the Class's own status. -->
	<div class="mb-6 rounded-xl border bg-card px-4 py-3">
		<div class="flex flex-wrap items-baseline gap-x-8 gap-y-2 text-xs">
			<div>
				<span class="text-muted-foreground">Through the plan</span>
				<span class="ml-1.5 font-medium tabular-nums">
					{SUBJECT.taught} / {SUBJECT.total} Lessons
				</span>
			</div>
			<div>
				<span class="text-muted-foreground">Last taught</span>
				<button type="button" class="ml-1.5 font-medium hover:underline">
					{SUBJECT.lastTaught?.title}
				</button>
			</div>
			<div>
				<span class="text-muted-foreground">Next up</span>
				<span class="ml-1.5 font-medium">{SUBJECT.nextUp?.title}</span>
			</div>
			<div>
				<span class="text-muted-foreground">Runway</span>
				<span class="ml-1.5 font-medium">
					{SUBJECT.runway.date ? fmtLong(SUBJECT.runway.date) : 'open-ended'}
				</span>
			</div>
		</div>
		<Progress value={SUBJECT.taught} max={SUBJECT.total} class="mt-2.5 h-1" />
	</div>

	<Card.Root class="mb-6">
		<Card.Header>
			<Card.Title>Timetable</Card.Title>
			<Card.Description>
				Tick the Periods this Class is taught. A double is two Periods, ticked separately.
			</Card.Description>
			<Card.Action><EffectiveFromPopover bind:from /></Card.Action>
		</Card.Header>
		<Card.Content>
			<SlotGridPair />
			<p class="mt-3 text-xs text-muted-foreground">
				Greyed Periods belong to another Class — you cannot be in two rooms at once.
			</p>

			{#if DATED_SLOTS.length}
				<div class="mt-4 rounded-lg bg-muted/40 px-3 py-2">
					<p class="text-xs font-medium">Slots that do not hold all year</p>
					<ul class="mt-1 space-y-0.5 text-xs text-muted-foreground">
						{#each DATED_SLOTS as s (s.id)}
							<li>
								<span class="font-medium text-foreground">
									Week {s.week} · {DAYS[s.day - 1]} · P{s.period}
								</span>
								{#if s.holdsFrom}from {fmtLong(s.holdsFrom)}{/if}
								{#if s.holdsTo}{s.holdsFrom ? ', ' : ''}until {fmtLong(s.holdsTo)}{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>Assigned Topics</Card.Title>
			<Card.Description>
				{SUBJECT.classLabel} teaches these, in this order — decide the next one as you reach it.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<TopicsGrid />
		</Card.Content>
	</Card.Root>
</div>
