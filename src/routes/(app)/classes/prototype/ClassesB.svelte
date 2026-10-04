<!--
	PROTOTYPE ONLY (issue #313). Variant B, "A list, and both weeks side by side". Departs from tiles.
	- Classes: one row per Class, the whole row a link; columns for the Course, the progress, the
	  Topic and next Lesson, and the Runway. On a phone each row is the Class and its next Lesson.
	  New Class sits in the header, from a tablet up.
	- Class page: no rail. A band across the top holds the Class and its progress. Below it, from
	  `lg`, Week A and Week B stand side by side, so the whole fortnight fits in one laptop window.
	  The Assigned Topics follow, with their controls always shown.
	- Tablet: the weeks stack. Phone: the band, the Assigned Topics (no controls) and the Timetable
	  as a list.
-->
<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { classTone } from '$lib/class-tone';
	import { formatDate, formatDateShort } from '$lib/date';
	import PageHeader from '$lib/components/page-header.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
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
		classById,
		classParam,
		datedSlots,
		lane,
		onParam,
		slotsOf,
		to
	} from './store.svelte';

	const klass = $derived(classById(classParam()));
	const past = $derived(onParam() < TODAY);
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
				<Button size="sm" class="max-md:hidden"><PlusIcon />New Class</Button>
			{/snippet}
		</PageHeader>

		<div class="overflow-hidden rounded-xl border">
			<div
				class="grid grid-cols-[6rem_9rem_8rem_minmax(0,1fr)_6rem_1.5rem] gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground max-md:hidden"
			>
				<span>Class</span><span>Course</span><span>Progress</span><span>Topic · Next</span><span
					>Runway</span
				><span></span>
			</div>
			<ul class="divide-y">
				{#each CLASSES as c (c.id)}
					{@const l = lane(c)}
					{@const pct = l.total ? Math.round((l.taught / l.total) * 100) : 0}
					<li>
						<a
							href={to({ class: c.id })}
							class="grid min-h-14 grid-cols-[minmax(0,1fr)_1.5rem] items-center gap-x-4 gap-y-0.5 px-4 py-2.5 hover:bg-muted/40 md:grid-cols-[6rem_9rem_8rem_minmax(0,1fr)_6rem_1.5rem]"
						>
							<span class="flex items-center gap-2 font-semibold">
								{@render dot(c.tone)}{c.label}
								<span class="text-xs font-normal text-muted-foreground md:hidden">{c.course}</span>
							</span>
							<span class="truncate text-sm text-muted-foreground max-md:hidden">{c.course}</span>
							<span class="flex items-center gap-2 max-md:hidden">
								<span class="h-1 flex-1 overflow-hidden rounded-full bg-muted">
									<span
										class="block h-full"
										style:width="{pct}%"
										style:background-color={classTone(c.tone).ring}
									></span>
								</span>
								<span class="w-8 text-right text-xs text-muted-foreground tabular-nums">{pct}%</span
								>
							</span>
							<span class="min-w-0 text-sm max-md:col-start-1 max-md:row-start-2">
								<span class="text-muted-foreground max-md:hidden"
									>{l.nextUp?.topicName ?? '—'} ·</span
								>
								<span class="max-md:text-xs max-md:text-muted-foreground"
									>{l.nextUp?.title ?? '—'}</span
								>
							</span>
							<span class="text-sm tabular-nums max-md:hidden">
								{l.runway ? formatDateShort(l.runway) : 'open-ended'}
							</span>
							<ChevronRightIcon
								class="size-4 text-muted-foreground max-md:col-start-2 max-md:row-span-2 max-md:row-start-1"
							/>
						</a>
					</li>
				{/each}
			</ul>
		</div>
	</div>
{:else}
	<div class="mx-auto max-w-6xl px-4 py-6 md:px-6">
		<Button variant="ghost" size="sm" class="mb-2 -ml-2 max-md:h-11" href={to()}>
			<ArrowLeftIcon />Classes
		</Button>

		<div class="rounded-xl border p-4">
			<div class="flex items-center gap-3">
				{@render dot(klass.tone)}
				<h1 class="text-lg font-semibold tracking-tight">{klass.label}</h1>
				<span class="text-sm text-muted-foreground">{klass.course}</span>
			</div>
			<div class="mt-3"><Progress {klass} inline /></div>
		</div>

		<section class="mt-6 max-md:hidden">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h2 class="text-sm font-semibold">
					Timetable
					<span class="ml-1 text-xs font-normal text-muted-foreground tabular-nums">
						{slotsOf(klass.id).length} Slots a fortnight
					</span>
				</h2>
				<AsAt {klass} />
			</div>
			<div class="mt-3 grid gap-x-8 gap-y-5 lg:grid-cols-2">
				{#each WEEKS as w (w)}<WeekGrid {klass} week={w} readOnly={past} cell="h-7" />{/each}
			</div>
			{#if datedSlots[klass.id]}
				<p class="mt-2 text-xs text-muted-foreground">
					Does not hold all year:
					{#each datedSlots[klass.id] as d (d.text)}
						<span class="font-medium text-foreground"
							>Week {d.week} · {DAYS[d.day - 1]} · P{d.period}</span
						>
						{d.text.split(' ')[0]}
						{formatDate(d.text.split(' ')[1])}
					{/each}
				</p>
			{/if}
		</section>

		<div class="mt-6 grid gap-6 md:grid-cols-2">
			<div class="max-md:hidden"><Topics {klass} controls="always" /></div>
			<div class="md:hidden"><Topics {klass} controls="none" /></div>
			<section class="md:hidden">
				<h2 class="mb-1 text-sm font-semibold">Timetable</h2>
				<SlotList {klass} />
			</section>
		</div>
	</div>
{/if}
