<script lang="ts">
	import { goto } from '$app/navigation';
	import { classTone } from '$lib/class-tone';
	import { sessionPanel } from '$lib/client/session-panel.svelte';
	import PageHeader from '$lib/components/page-header.svelte';
	import { Button } from '$lib/components/ui/button';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group';
	import { AGENDA_HORIZONS } from './agenda-horizons';
	import { groupByDay, horizonEndsOn } from './agenda-days';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function setHorizon(horizonDays: number) {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- carries a query string
		goto(`?horizon=${horizonDays}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
			invalidateAll: true
		});
	}

	const fmtLongDay = (iso: string) =>
		new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			timeZone: 'UTC'
		});

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
				No Class is timetabled between now and {fmtLongDay(
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
					<span class="font-normal text-muted-foreground">— {fmtLongDay(day.date)}</span>
				{:else}
					<span class="text-muted-foreground">{fmtLongDay(day.date)}</span>
				{/if}
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
							class="min-w-0 flex-1 py-3 text-left outline-none focus-visible:underline"
							onclick={() =>
								sessionPanel.open({
									classId: row.classId,
									date: row.date,
									period: row.periodFrom
								})}
						>
							{#if row.lesson}
								<span class="block truncate text-sm font-medium">{row.lesson.title}</span>
								<span class="block truncate text-xs text-muted-foreground">
									{row.lesson.topicName}
								</span>
							{:else}
								<span class="block text-sm text-muted-foreground italic">Unplanned</span>
							{/if}
						</button>

						{#if !row.lesson}
							<Button
								variant="ghost"
								size="sm"
								class="h-7 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
								onclick={() =>
									sessionPanel.open({
										classId: row.classId,
										date: row.date,
										period: row.periodFrom
									})}
							>
								Plan
							</Button>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>
