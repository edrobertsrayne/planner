<!--
	PROTOTYPE ONLY (issue #313). Variant C, "Overview and Timetable tabs".
	- Classes: tiles in the shape the Courses screen chose (issue #306). The tile body is one link,
	  and the footer holds Assign next Topic (from a tablet up) and Open Class.
	- Class page: two tabs under the Class's name. Overview (the default): the progress beside the
	  Assigned Topics. Timetable: "Timetable as at" and both weeks at full width, with room for
	  taller cells. Each tab fits a laptop window on its own.
	- Assigned Topics read as a plain list. An Edit button shows the arrows and Unassign, so no
	  control hides behind hover.
	- Phone: the same two tabs. Overview reads without Edit; Timetable is the list.
-->
<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { classTone } from '$lib/class-tone';
	import { formatDate, formatDateShort } from '$lib/date';
	import PageHeader from '$lib/components/page-header.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
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
	let tab = $state<'overview' | 'timetable'>('overview');
</script>

{#snippet dot(tone: number)}
	{@const t = classTone(tone)}
	<span
		class="mt-1 size-2.5 shrink-0 rounded-full ring-2"
		style:background-color={t.bg}
		style:--tw-ring-color={t.ring}
		aria-hidden="true"
	></span>
{/snippet}

{#if !klass}
	<div class="mx-auto max-w-6xl px-4 py-6 md:px-6">
		<PageHeader title="Classes" />
		<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each CLASSES as c (c.id)}
				{@const l = lane(c)}
				{@const pct = l.total ? Math.round((l.taught / l.total) * 100) : 0}
				{@const left = courseTopics(c).filter((x) => !assigned[c.id].includes(x))}
				<li class="flex flex-col overflow-hidden rounded-xl border bg-card">
					<a href={to({ class: c.id })} class="flex flex-1 flex-col gap-3 p-4 hover:bg-muted/30">
						<div class="flex items-start gap-3">
							{@render dot(c.tone)}
							<div class="min-w-0">
								<div class="text-sm font-semibold">{c.label}</div>
								<div class="text-xs text-muted-foreground">{c.course}</div>
							</div>
						</div>
						<div class="h-1 overflow-hidden rounded-full bg-muted">
							<div
								class="h-full"
								style:width="{pct}%"
								style:background-color={classTone(c.tone).ring}
							></div>
						</div>
						<div class="mt-auto text-xs">
							<div class="font-medium">{l.nextUp?.topicName ?? '—'}</div>
							<div class="text-muted-foreground">Next: {l.nextUp?.title ?? '—'}</div>
							<div class="text-muted-foreground tabular-nums">
								Runway {l.runway ? formatDateShort(l.runway) : 'open-ended'}
							</div>
						</div>
					</a>
					<div class="flex items-center border-t px-2 py-1.5">
						<span class="flex-1 px-2 text-xs text-muted-foreground tabular-nums md:hidden"
							>{pct}% taught</span
						>
						<div class="min-w-0 flex-1 max-md:hidden">
							{#if left.length}
								<Select.Root type="single" onValueChange={(v) => v && assignTopic(c.id, v)}>
									<Select.Trigger
										size="sm"
										class="w-full min-w-0 justify-start border-0 bg-transparent px-2 text-xs text-muted-foreground"
									>
										<PlusIcon class="size-3.5" />Assign next Topic
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
							class="px-2 text-xs max-md:h-11"
							href={to({ class: c.id })}
						>
							Open Class<ChevronRightIcon />
						</Button>
					</div>
				</li>
			{/each}
			<li class="max-md:hidden">
				<button
					type="button"
					class="flex h-full min-h-40 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-muted-foreground hover:bg-muted/40 hover:text-foreground"
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
		<PageHeader class="pb-2">
			<div class="flex items-start gap-3">
				{@render dot(klass.tone)}
				<div>
					<h1 class="text-lg font-semibold tracking-tight">{klass.label}</h1>
					<p class="text-sm text-muted-foreground">{klass.course}</p>
				</div>
			</div>
		</PageHeader>

		<div class="flex border-b text-sm" role="tablist">
			{#each [['overview', 'Overview'], ['timetable', 'Timetable']] as [key, name] (key)}
				<button
					type="button"
					role="tab"
					aria-selected={tab === key}
					class="-mb-px min-h-11 border-b-2 px-4 font-medium md:min-h-9 {tab === key
						? 'border-primary text-foreground'
						: 'border-transparent text-muted-foreground hover:text-foreground'}"
					onclick={() => (tab = key as typeof tab)}
				>
					{name}
					{#if key === 'timetable'}
						<span class="text-xs tabular-nums opacity-60">{slotsOf(klass.id).length}</span>
					{/if}
				</button>
			{/each}
		</div>

		{#if tab === 'overview'}
			<div class="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				<div class="rounded-xl border p-4"><Progress {klass} /></div>
				<div class="max-md:hidden"><Topics {klass} controls="edit" /></div>
				<div class="md:hidden"><Topics {klass} controls="none" /></div>
			</div>
		{:else}
			<section class="mt-5">
				<div class="max-md:hidden">
					<AsAt {klass} />
					<div class="mt-4 space-y-6">
						{#each WEEKS as w (w)}<WeekGrid {klass} week={w} readOnly={past} cell="h-9" />{/each}
					</div>
					{#if datedSlots[klass.id]}
						<div class="mt-4 rounded-lg bg-muted/40 px-3 py-2 text-xs">
							<p class="font-medium">Slots that do not hold all year</p>
							{#each datedSlots[klass.id] as d (d.text)}
								<p class="text-muted-foreground">
									<span class="font-medium text-foreground"
										>Week {d.week} · {DAYS[d.day - 1]} · P{d.period}</span
									>
									{d.text.split(' ')[0]}
									{formatDate(d.text.split(' ')[1])}
								</p>
							{/each}
						</div>
					{/if}
				</div>
				<div class="md:hidden"><SlotList {klass} /></div>
			</section>
		{/if}
	</div>
{/if}
