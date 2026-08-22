<!--
	PROTOTYPE — throwaway. C's workbench layout, extracted so D and E can differ in the grid alone.
	Ed picked this layout off variant C; what is still open is which grid goes on the bench, so the
	rail, the toolbar and the proportions are held fixed and only the `grid` snippet changes.
-->
<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import EffectiveFromScrubber from './EffectiveFromScrubber.svelte';
	import TopicsRail from './TopicsRail.svelte';
	import { SUBJECT, GRID, fmtLong } from './fixtures';
	import type { Snippet } from 'svelte';

	let { grid, note }: { grid: Snippet; note: string } = $props();

	let from = $state<string | null>(null);

	const mySlots = GRID.filter((s) => s.classId === SUBJECT.classId).length;
</script>

<div class="mx-auto max-w-6xl px-6 py-6">
	<a
		href="##"
		class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
	>
		<ChevronLeftIcon class="size-3" />Classes
	</a>

	<div class="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
		<section class="min-w-0">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<h2 class="text-sm font-semibold">Timetable</h2>
				<span class="text-xs text-muted-foreground tabular-nums">
					{mySlots} Slots a fortnight
				</span>
			</div>

			<div class="mt-3 rounded-xl border p-4">
				<EffectiveFromScrubber bind:from />
				<Separator class="my-3" />
				{@render grid()}
				<p class="mt-3 text-xs text-muted-foreground">
					Greyed Periods belong to another Class. A double is two Periods, ticked separately.
				</p>
				<p class="mt-1 text-xs text-muted-foreground/70">{note}</p>
			</div>
		</section>

		<aside class="space-y-5 lg:sticky lg:top-20 lg:self-start">
			<div>
				<h1 class="text-lg font-semibold tracking-tight">{SUBJECT.classLabel}</h1>
				<Badge variant="outline" class="mt-1">{SUBJECT.courseName}</Badge>
			</div>

			<div>
				<div class="flex items-baseline justify-between text-xs">
					<span class="text-muted-foreground">Through the plan</span>
					<span class="font-medium tabular-nums">{SUBJECT.taught} / {SUBJECT.total}</span>
				</div>
				<Progress value={SUBJECT.taught} max={SUBJECT.total} class="mt-1.5 h-1" />
				<dl class="mt-3 space-y-1.5 text-xs">
					<div>
						<dt class="text-muted-foreground">Last taught</dt>
						<dd>
							<button type="button" class="text-left font-medium hover:underline">
								{SUBJECT.lastTaught?.title}
							</button>
							{#if SUBJECT.lastTaught?.note}
								<p class="mt-0.5 text-muted-foreground">{SUBJECT.lastTaught.note}</p>
							{/if}
						</dd>
					</div>
					<div>
						<dt class="text-muted-foreground">Next up</dt>
						<dd class="font-medium">{SUBJECT.nextUp?.title}</dd>
					</div>
					<div>
						<dt class="text-muted-foreground">Runway</dt>
						<dd class="font-medium">
							{SUBJECT.runway.date ? fmtLong(SUBJECT.runway.date) : 'open-ended'}
						</dd>
					</div>
				</dl>
			</div>

			<div>
				<h2 class="mb-2 text-sm font-semibold">Assigned Topics</h2>
				<TopicsRail />
			</div>
		</aside>
	</div>
</div>
