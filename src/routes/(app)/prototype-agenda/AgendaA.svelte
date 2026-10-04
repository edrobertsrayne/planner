<!--
	PROTOTYPE ONLY (issue #310). Variant A: today's Agenda, one column, with a row of Tag chips in
	place of the dropdown — the same control as the Class chips on Planning. The horizon is tabs,
	the look-back a button. On a phone the chips scroll sideways and every row target is 44 px.

	Issue #311 adds `expand`: when given, a row opens its Session in place below itself (the
	Session panel's variant B), and a second click closes it. Width and heading follow #316.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import { classTone } from '$lib/class-tone';
	import { formatWeekday } from '$lib/date';
	import TagChips from '$lib/components/tag-chips.svelte';
	import ClassChip from '../planning/prototype/ClassChip.svelte';
	import Tick from './Tick.svelte';
	import {
		HORIZONS,
		TODAY,
		horizonEnd,
		horizonParam,
		openSession,
		pastParam,
		sessionParam,
		set,
		tagCount,
		tagParam,
		view,
		type Row
	} from './store.svelte';

	const horizon = $derived(horizonParam());
	const tag = $derived(tagParam());
	const past = $derived(pastParam());
	const v = $derived(view(horizon, tag, past));

	let { expand }: { expand?: Snippet<[Row]> } = $props();
	const openKey = $derived(sessionParam());
	const open = (r: Row) => (expand && openKey === r.key ? set({ session: null }) : openSession(r));
</script>

{#snippet row(r: Row, isPast: boolean)}
	<li class="relative flex items-center gap-3 pr-1 pl-4 hover:bg-muted/40 md:pr-2">
		<span
			class="absolute inset-y-0 left-0 w-1"
			style:background-color={classTone(r.tone).ring}
			aria-hidden="true"
		></span>
		<span class="w-12 shrink-0 text-xs text-muted-foreground tabular-nums">
			P{r.periodFrom}{#if r.periodTo !== r.periodFrom}–{r.periodTo}{/if}
		</span>
		<span class="w-10 shrink-0"><ClassChip label={r.classLabel} tone={r.tone} /></span>
		<button
			type="button"
			class="min-w-0 flex-1 py-3 text-left outline-none focus-visible:underline"
			onclick={() => open(r)}
		>
			{#if r.lesson}
				<span class="block text-sm font-medium">{r.lesson.title}</span>
				<span class="block text-xs text-muted-foreground">
					{r.lesson.topicName ?? 'Standalone Lesson'}
				</span>
				<TagChips tags={r.lesson.tags} class="mt-1" />
			{:else}
				<span class="block text-sm text-muted-foreground italic">Open Slot</span>
			{/if}
		</button>
		{#if !r.lesson}
			<button
				type="button"
				class="h-11 rounded-md px-3 text-xs font-medium text-muted-foreground hover:bg-muted md:h-8"
				onclick={() => open(r)}>Plan</button
			>
		{:else if !isPast}
			<Tick row={r} />
		{/if}
	</li>
	{#if expand && openKey === r.key}
		<li>{@render expand(r)}</li>
	{/if}
{/snippet}

<div class="mx-auto max-w-6xl px-4 py-6 md:px-6">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<h1 class="hidden text-xl font-semibold md:block">Agenda</h1>
		<div class="flex w-full flex-wrap items-center gap-2 md:w-auto">
			<div class="flex border-b text-sm" role="tablist" aria-label="How far ahead">
				{#each HORIZONS as [key, name] (key)}
					<button
						type="button"
						role="tab"
						aria-selected={horizon === key}
						class="-mb-px border-b-2 px-2.5 py-1.5 font-medium whitespace-nowrap {horizon === key
							? 'border-primary text-foreground'
							: 'border-transparent text-muted-foreground hover:text-foreground'}"
						onclick={() => set({ horizon: key })}>{name}</button
					>
				{/each}
			</div>
		</div>
	</div>

	<div
		class="-mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
		role="group"
		aria-label="Filter by Tag"
	>
		<button
			type="button"
			aria-pressed={!tag}
			class="h-8 rounded-2xl border px-3 text-xs font-medium whitespace-nowrap md:h-6 md:px-2.5 {tag
				? 'text-muted-foreground hover:bg-muted'
				: 'border-transparent bg-primary text-primary-foreground'}"
			onclick={() => set({ tag: null })}>All Lessons</button
		>
		{#each v.tags as t (t)}
			{@const on = tag === t}
			<button
				type="button"
				aria-pressed={on}
				class="h-8 rounded-2xl border px-3 text-xs font-medium whitespace-nowrap md:h-6 md:px-2.5 {on
					? 'border-transparent bg-primary text-primary-foreground'
					: 'text-muted-foreground hover:bg-muted'}"
				onclick={() => set({ tag: on ? null : t })}
			>
				{t}
				<span class="tabular-nums opacity-60">{tagCount([...v.back, ...v.ahead], t)}</span>
			</button>
		{/each}
	</div>

	<button
		type="button"
		class="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed text-xs font-medium text-muted-foreground hover:bg-muted md:h-8"
		onclick={() => set({ past: past ? null : '1' })}
	>
		<HistoryIcon class="size-3.5" />
		{past ? 'Hide the previous 7 days' : 'Show the previous 7 days'}
	</button>

	{#each v.pastDays as day (day.date)}
		<section class="mt-6">
			<h2 class="mb-2 text-sm font-semibold text-muted-foreground">{formatWeekday(day.date)}</h2>
			<ul class="divide-y overflow-hidden rounded-xl border bg-muted/50">
				{#each day.rows as r (r.key)}{@render row(r, true)}{/each}
			</ul>
		</section>
	{/each}

	{#if v.days.length === 0}
		<div class="mt-6 rounded-xl border border-dashed px-6 py-12 text-center">
			<p class="text-sm font-medium">Nothing in this window</p>
			<p class="mt-1 text-sm text-muted-foreground">
				{tag ? `No Lessons with the Tag “${tag}”` : 'No Class is timetabled'} between now and
				{formatWeekday(horizonEnd(horizon))}.
			</p>
		</div>
	{/if}

	{#each v.days as day (day.date)}
		<section class="mt-6">
			<h2 class="mb-2 flex items-baseline gap-2 text-sm font-semibold">
				{#if day.date === TODAY}
					<span>Today</span>
					<span class="font-normal text-muted-foreground">— {formatWeekday(day.date)}</span>
				{:else}
					<span class="text-muted-foreground">{formatWeekday(day.date)}</span>
				{/if}
				<span class="ml-auto text-xs font-normal text-muted-foreground">Ready?</span>
			</h2>
			<ul class="divide-y overflow-hidden rounded-xl border bg-card">
				{#each day.rows as r (r.key)}{@render row(r, false)}{/each}
			</ul>
		</section>
	{/each}
</div>
