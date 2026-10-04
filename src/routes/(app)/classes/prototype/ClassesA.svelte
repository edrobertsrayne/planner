<!--
	PROTOTYPE ONLY (issue #313). Variant A, "The bench, kept". Today's tiles and today's bench, made
	to give way by size:
	- Classes: tiles in 1, 2 or 3 columns. On a phone the footer keeps only Open Class page, and
	  New Class is gone, because nothing is written there.
	- Class page from `lg`: the Slot grid on the left (both weeks stacked), the rail on the right.
	- Tablet (`md` to `lg`): one column. The Class and its progress first, then the grid, which can
	  still be written, then the Assigned Topics.
	- Phone: a read view. Progress, Assigned Topics (no controls) and the Timetable as a list.
	- Assigned Topics controls show on hover, and always on a touch screen.
-->
<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { classTone } from '$lib/class-tone';
	import { formatDate, formatDateShort } from '$lib/date';
	import PageHeader from '$lib/components/page-header.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import AsAt from './AsAt.svelte';
	import Progress from './Progress.svelte';
	import SlotList from './SlotList.svelte';
	import Topics from './Topics.svelte';
	import WeekGrid from './WeekGrid.svelte';
	import {
		CLASSES,
		DAYS,
		TODAY,
		WEEKS,
		assignTopic,
		assigned,
		classById,
		classParam,
		courseTopics,
		datedSlots,
		lane,
		onParam,
		slotsOf,
		to
	} from './store.svelte';

	const klass = $derived(classById(classParam()));
	const past = $derived(onParam() < TODAY);
</script>

{#if !klass}
	<div class="mx-auto max-w-6xl px-4 py-6 md:px-6">
		<PageHeader title="Classes" />
		<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each CLASSES as c (c.id)}
				{@const t = classTone(c.tone)}
				{@const l = lane(c)}
				{@const pct = l.total ? Math.round((l.taught / l.total) * 100) : 0}
				{@const left = courseTopics(c).filter((x) => !assigned[c.id].includes(x))}
				<li class="flex flex-col overflow-hidden rounded-xl border bg-card">
					<div class="flex flex-1 flex-col gap-3 p-4">
						<div class="flex items-start gap-3">
							<span
								class="mt-0.5 size-2.5 shrink-0 rounded-full ring-2"
								style:background-color={t.bg}
								style:--tw-ring-color={t.ring}
								aria-hidden="true"
							></span>
							<div class="min-w-0 flex-1">
								<a
									href={to({ class: c.id })}
									class="block truncate text-sm font-semibold hover:underline"
								>
									{c.label}
								</a>
								<div class="truncate text-xs text-muted-foreground">{c.course}</div>
							</div>
							<div class="text-xs text-muted-foreground tabular-nums">{pct}%</div>
						</div>
						<div class="h-1 overflow-hidden rounded-full bg-muted">
							<div class="h-full" style:width="{pct}%" style:background-color={t.ring}></div>
						</div>
						<dl class="mt-auto space-y-1 text-xs">
							<div class="flex gap-1.5">
								<dt class="shrink-0 text-muted-foreground">Topic</dt>
								<dd class="truncate font-medium">{l.nextUp?.topicName ?? '—'}</dd>
							</div>
							<div class="flex gap-1.5">
								<dt class="shrink-0 text-muted-foreground">Next</dt>
								<dd class="truncate">{l.nextUp?.title ?? '—'}</dd>
							</div>
							<div class="flex gap-1.5">
								<dt class="shrink-0 text-muted-foreground">Runway</dt>
								<dd class="truncate tabular-nums">
									{l.runway ? formatDateShort(l.runway) : 'open-ended'}
								</dd>
							</div>
						</dl>
					</div>
					<div class="flex items-center gap-1 border-t px-2 py-1.5">
						<div class="min-w-0 flex-1 max-md:hidden">
							{#if left.length}
								<Select.Root type="single" onValueChange={(v) => v && assignTopic(c.id, v)}>
									<Select.Trigger
										size="sm"
										class="w-full min-w-0 justify-start border-0 bg-transparent px-2 text-xs text-muted-foreground"
									>
										Assign next Topic
									</Select.Trigger>
									<Select.Content>
										{#each left as x (x)}<Select.Item value={x} label={x} />{/each}
									</Select.Content>
								</Select.Root>
							{/if}
						</div>
						<Button
							variant="ghost"
							size="sm"
							class="shrink-0 px-2 text-xs max-md:ml-auto max-md:h-11"
							href={to({ class: c.id })}
						>
							Open Class page<ChevronRightIcon />
						</Button>
					</div>
				</li>
			{/each}
			<li class="max-md:hidden">
				<button
					type="button"
					class="flex h-full min-h-44 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-muted-foreground hover:bg-muted/40 hover:text-foreground"
				>
					<PlusIcon class="size-4" /><span class="text-sm font-medium">New Class</span>
				</button>
			</li>
		</ul>
	</div>
{:else}
	<div class="mx-auto max-w-6xl px-4 py-6 md:px-6">
		<Button variant="ghost" size="sm" class="mb-2 -ml-2 max-md:h-11" href={to()}>
			<ArrowLeftIcon />Classes
		</Button>

		<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
			<!-- The Class and its progress: top on a tablet and phone, in the rail from lg. -->
			<div class="space-y-5 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:self-start">
				<div>
					<h1 class="text-lg font-semibold tracking-tight">{klass.label}</h1>
					<Badge variant="outline" class="mt-1">{klass.course}</Badge>
				</div>
				<Progress {klass} />
				<Separator class="max-lg:hidden" />
				<div class="max-lg:hidden"><Topics {klass} controls="hover" /></div>
			</div>

			<!-- The grid: written from a tablet up. -->
			<section class="min-w-0 max-md:hidden lg:col-start-1 lg:row-span-2 lg:row-start-1">
				<div class="flex flex-wrap items-baseline justify-between gap-2">
					<h2 class="text-sm font-semibold">Timetable</h2>
					<span class="text-xs text-muted-foreground tabular-nums">
						{slotsOf(klass.id).length} Slots a fortnight
					</span>
				</div>
				<div class="mt-2"><AsAt {klass} /></div>
				<div class="mt-3 space-y-5 rounded-xl border p-4">
					{#each WEEKS as w (w)}<WeekGrid {klass} week={w} readOnly={past} />{/each}
					{#if datedSlots[klass.id]}
						<div class="rounded-lg bg-muted/40 px-3 py-2 text-xs">
							<p class="font-medium">Slots that do not hold all year</p>
							{#each datedSlots[klass.id] as d (d.text)}
								<p class="text-muted-foreground">
									<span class="font-medium text-foreground">
										Week {d.week} · {DAYS[d.day - 1]} · P{d.period}
									</span>
									{d.text.split(' ')[0]}
									{formatDate(d.text.split(' ')[1])}
								</p>
							{/each}
						</div>
					{/if}
				</div>
			</section>

			<!-- Tablet: Assigned Topics below the grid. -->
			<div class="max-md:hidden lg:hidden"><Topics {klass} controls="hover" /></div>

			<!-- Phone: the read view. -->
			<div class="space-y-6 md:hidden">
				<Topics {klass} controls="none" />
				<section>
					<h2 class="mb-1 text-sm font-semibold">Timetable</h2>
					<SlotList {klass} />
				</section>
			</div>
		</div>
	</div>
{/if}
