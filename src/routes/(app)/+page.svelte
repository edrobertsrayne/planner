<script lang="ts">
	import { classTone } from '$lib/class-tone';
	import { tagColor } from '$lib/tag-color';
	import { formatWeekday } from '$lib/date';
	import { replaceQuery } from '$lib/client/enhance';
	import { openSession } from '$lib/client/session-panel.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
	import { AGENDA_HORIZONS } from './agenda-horizons';
	import { groupByDay, horizonEndsOn } from './agenda-days';
	import ReadyTick from './ready-tick.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const setHorizon = (horizonDays: number) => replaceQuery(`?horizon=${horizonDays}`);

	function openOccasion(row: (typeof data.rows)[number]) {
		openSession({ classId: row.classId, date: row.date, period: row.periodFrom });
	}

	const days = $derived(groupByDay(data.rows));
</script>

<svelte:head><title>Agenda</title></svelte:head>

<div class="mx-auto max-w-3xl px-6 py-6">
	<PageHeader title="Agenda" description="What is coming up, in order.">
		{#snippet actions()}
			<ToggleGroup
				type="single"
				variant="outline"
				size="sm"
				value={String(data.horizonDays)}
				onValueChange={(v) => {
					if (v) setHorizon(Number(v));
				}}
			>
				{#each AGENDA_HORIZONS as [n, label] (n)}
					<ToggleGroupItem value={String(n)}>{label}</ToggleGroupItem>
				{/each}
			</ToggleGroup>
		{/snippet}
	</PageHeader>

	{#if days.length === 0}
		<div class="mt-6 rounded-xl border border-dashed px-6 py-12 text-center">
			<p class="text-sm font-medium">Nothing in this window</p>
			<p class="mt-1 text-sm text-muted-foreground">
				No Class is timetabled between now and {formatWeekday(
					horizonEndsOn(data.today, data.horizonDays)
				)}.
			</p>
		</div>
	{/if}

	{#each days as day (day.date)}
		{@const isToday = day.date === data.today}
		<section class="mt-6">
			<h2 class="mb-2 flex items-baseline gap-2 text-sm font-semibold">
				{#if isToday}
					<span class="text-foreground">Today</span>
					<span class="font-normal text-muted-foreground">— {formatWeekday(day.date)}</span>
				{:else}
					<span class="text-muted-foreground">{formatWeekday(day.date)}</span>
				{/if}
				<span class="ml-auto text-xs font-normal text-muted-foreground">Ready to teach?</span>
			</h2>

			<ul class="divide-y divide-border overflow-hidden rounded-xl border bg-card">
				{#each day.rows as row (row.classId + row.periodFrom)}
					{@const tone = classTone(row.tone)}
					<li class="group/row relative flex items-center gap-3 pr-2 pl-4 hover:bg-muted/40">
						<span
							class="absolute inset-y-0 left-0 w-1"
							style:background-color={tone.ring}
							aria-hidden="true"
						></span>

						<span class="w-14 shrink-0 text-xs text-muted-foreground tabular-nums">
							P{row.periodFrom}{#if row.periodTo !== row.periodFrom}–P{row.periodTo}{/if}
						</span>

						<span
							class="h-fit shrink-0 rounded-2xl px-2 py-0.5 text-xs font-medium"
							style:background-color={tone.bg}
							style:color={tone.fg}
						>
							{row.classLabel}
						</span>

						<button
							type="button"
							data-session-trigger
							class="min-w-0 flex-1 py-3 text-left outline-none focus-visible:underline"
							onclick={() => openOccasion(row)}
						>
							{#if row.lesson}
								<span class="block truncate text-sm font-medium">{row.lesson.title}</span>
								<span class="block truncate text-xs text-muted-foreground">
									{#if row.lesson.topicName}
										{row.lesson.topicName}
									{/if}
								</span>
								{#if row.lesson.tags.length}
									<div class="mt-1 flex flex-wrap gap-1">
										{#each row.lesson.tags as tag (tag)}
											{@const color = tagColor(tag)}
											<Badge
												variant="outline"
												class="text-[10px]"
												style="background-color: {color.bg}; color: {color.fg}; border-color: transparent;"
											>
												{tag}
											</Badge>
										{/each}
									</div>
								{/if}
							{:else}
								<span class="block text-sm text-muted-foreground italic">Open Slot</span>
							{/if}
						</button>

						{#if !row.lesson}
							<Button
								variant="ghost"
								size="sm"
								class="h-7 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
								data-session-trigger
								onclick={() => openOccasion(row)}
							>
								Plan
							</Button>
						{:else}
							<ReadyTick
								lessonId={row.lesson.id}
								classId={row.classId}
								ready={row.lesson.ready}
								label="Ready to teach {row.lesson.title} to {row.classLabel}"
							/>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>
