<!--
	PROTOTYPE ONLY (issue #313). Variant D, "One week at a time, Classes by Course".
	- Classes: grouped under each Course, smaller tiles. On a phone each group is a short list.
	- Class page from `lg`: one week of the grid at a time, picked by a Week A / Week B switch, with
	  tall cells that are easy to hit. The rail on the right holds the Class, its progress and the
	  Assigned Topics. The page fits a laptop window with no scroll.
	- Tablet: the grid, then the rail below it.
	- Phone: a different read view. The Class's next Sessions first (each opens the Session page),
	  then its progress, its Assigned Topics and the Timetable as a list.
-->
<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { classTone } from '$lib/class-tone';
	import { formatDateShort, formatShortWeekday } from '$lib/date';
	import PageHeader from '$lib/components/page-header.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import AsAt from './AsAt.svelte';
	import Progress from './Progress.svelte';
	import SlotList from './SlotList.svelte';
	import Topics from './Topics.svelte';
	import WeekGrid from './WeekGrid.svelte';
	import {
		CLASSES,
		TODAY,
		WEEKS,
		classById,
		classParam,
		lane,
		onParam,
		sessionHref,
		slotsOf,
		to,
		type Week
	} from './store.svelte';

	const klass = $derived(classById(classParam()));
	const past = $derived(onParam() < TODAY);
	const courses = [...new Set(CLASSES.map((c) => c.course))];
	let week = $state<Week>('A');
</script>

{#snippet dot(tone: number)}
	{@const t = classTone(tone)}
	<span
		class="size-2.5 shrink-0 rounded-full ring-2"
		style:background-color={t.bg}
		style:--tw-ring-color={t.ring}
		aria-hidden="true"
	></span>
{/snippet}

{#if !klass}
	<div class="mx-auto max-w-6xl px-4 py-6 md:px-6">
		<PageHeader title="Classes">
			{#snippet actions()}
				<Button size="sm" variant="outline" class="max-md:hidden"><PlusIcon />New Class</Button>
			{/snippet}
		</PageHeader>
		<div class="space-y-6">
			{#each courses as course (course)}
				<section>
					<h2 class="pb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
						{course}
					</h2>
					<ul
						class="grid grid-cols-1 gap-2 max-md:gap-0 max-md:divide-y max-md:rounded-xl max-md:border md:grid-cols-3 lg:grid-cols-4"
					>
						{#each CLASSES.filter((c) => c.course === course) as c (c.id)}
							{@const l = lane(c)}
							{@const pct = l.total ? Math.round((l.taught / l.total) * 100) : 0}
							<li>
								<a
									href={to({ class: c.id })}
									class="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-muted/40 md:flex-col md:items-stretch md:gap-2 md:rounded-xl md:border md:p-3"
								>
									<div class="flex items-center gap-2">
										{@render dot(c.tone)}
										<span class="font-semibold">{c.label}</span>
										<span class="ml-auto text-xs text-muted-foreground tabular-nums max-md:hidden"
											>{pct}%</span
										>
									</div>
									<div class="h-1 overflow-hidden rounded-full bg-muted max-md:hidden">
										<div
											class="h-full"
											style:width="{pct}%"
											style:background-color={classTone(c.tone).ring}
										></div>
									</div>
									<div class="min-w-0 flex-1 text-xs">
										<div class="truncate">{l.nextUp?.title ?? '—'}</div>
										<div class="truncate text-muted-foreground tabular-nums">
											Runway {l.runway ? formatDateShort(l.runway) : 'open-ended'}
										</div>
									</div>
									<ChevronRightIcon class="size-4 text-muted-foreground md:hidden" />
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	</div>
{:else}
	<div class="mx-auto max-w-6xl px-4 py-6 md:px-6">
		<Button variant="ghost" size="sm" class="mb-2 -ml-2 max-md:h-11" href={to()}>
			<ArrowLeftIcon />Classes
		</Button>

		<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
			<!-- Phone: the next Sessions lead. -->
			<div class="min-w-0 space-y-5 md:hidden">
				<div class="flex items-center gap-3">
					{@render dot(klass.tone)}
					<h1 class="text-lg font-semibold tracking-tight">{klass.label}</h1>
					<span class="text-sm text-muted-foreground">{klass.course}</span>
				</div>
				<section>
					<h2 class="mb-1 text-sm font-semibold">Next Sessions</h2>
					<ul class="divide-y rounded-xl border">
						{#each lane(klass).upcoming as r (r.key)}
							<li>
								<a href={sessionHref(r)} class="flex min-h-12 items-center gap-3 px-3 py-2">
									<span
										class="w-24 shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular-nums"
									>
										{formatShortWeekday(r.date)} P{r.periodFrom}
									</span>
									<span class="min-w-0 flex-1 truncate text-sm">
										{r.lesson?.title ?? 'Open Slot'}
									</span>
									<ChevronRightIcon class="size-4 text-muted-foreground" />
								</a>
							</li>
						{/each}
					</ul>
				</section>
				<Progress {klass} />
				<Topics {klass} controls="none" />
				<section>
					<h2 class="mb-1 text-sm font-semibold">Timetable</h2>
					<SlotList {klass} />
				</section>
			</div>

			<!-- Tablet and up: one week of the grid. -->
			<section class="min-w-0 max-md:hidden">
				<div class="mb-4 flex items-center gap-3 lg:hidden">
					{@render dot(klass.tone)}
					<h1 class="text-lg font-semibold tracking-tight">{klass.label}</h1>
					<span class="text-sm text-muted-foreground">{klass.course}</span>
				</div>
				<div class="flex flex-wrap items-center gap-3">
					<div class="inline-flex rounded-lg border p-0.5" role="tablist">
						{#each WEEKS as w (w)}
							<button
								type="button"
								role="tab"
								aria-selected={week === w}
								class="rounded-md px-3 py-1 text-sm font-medium {week === w
									? 'bg-primary text-primary-foreground'
									: 'text-muted-foreground hover:text-foreground'}"
								onclick={() => (week = w)}
							>
								Week {w}
								<span class="text-xs tabular-nums opacity-70">{slotsOf(klass.id, w).length}</span>
							</button>
						{/each}
					</div>
					<AsAt {klass} label={false} />
				</div>
				<div class="mt-3 rounded-xl border p-3">
					<WeekGrid {klass} {week} readOnly={past} cell="h-12" heading={false} />
				</div>
			</section>

			<aside class="space-y-5 max-md:hidden lg:sticky lg:top-6 lg:self-start">
				<div class="max-lg:hidden">
					<div class="flex items-center gap-3">
						{@render dot(klass.tone)}
						<h1 class="text-lg font-semibold tracking-tight">{klass.label}</h1>
					</div>
					<p class="text-sm text-muted-foreground">{klass.course}</p>
				</div>
				<Progress {klass} />
				<Topics {klass} controls="always" />
			</aside>
		</div>
	</div>
{/if}
