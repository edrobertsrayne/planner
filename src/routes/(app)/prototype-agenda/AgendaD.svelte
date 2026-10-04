<!--
	PROTOTYPE ONLY (issue #310). Variant D: today first. The next teaching day leads as large
	cards, each with a labelled Ready button. Later days fold into one line each ("Tue 7 Oct · 5
	Sessions · 3 ready") that opens to the list. There is no horizon control: "Show more days"
	reaches further, in the real horizon's steps. The Tag filter is the Tags themselves: a click on
	a Tag on any row narrows to it, and the Tag shows at the top as a pill you can clear.
-->
<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import XIcon from '@lucide/svelte/icons/x';
	import { classTone } from '$lib/class-tone';
	import { formatShortWeekday, formatWeekday } from '$lib/date';
	import ClassChip from '../planning/prototype/ClassChip.svelte';
	import Tick from './Tick.svelte';
	import {
		HORIZONS,
		TODAY,
		horizonParam,
		isReady,
		openSession,
		pastParam,
		set,
		tagParam,
		view,
		type Row
	} from './store.svelte';

	const horizon = $derived(horizonParam());
	const tag = $derived(tagParam());
	const past = $derived(pastParam());
	const v = $derived(view(horizon, tag, past));
	const lead = $derived(v.days[0] ?? null);
	const rest = $derived(v.days.slice(1));
	const nextHorizon = $derived(HORIZONS[HORIZONS.findIndex(([k]) => k === horizon) + 1] ?? null);
</script>

{#snippet tags(r: Row)}
	{#if r.lesson?.tags.length}
		<span class="mt-1 flex flex-wrap gap-1">
			{#each r.lesson.tags as t (t)}
				<button
					type="button"
					title="Show only “{t}”"
					class="rounded-full border px-2 py-0.5 text-[11px] font-medium hover:border-primary hover:text-primary {tag ===
					t
						? 'border-primary bg-primary text-primary-foreground hover:text-primary-foreground'
						: 'text-muted-foreground'}"
					onclick={() => set({ tag: tag === t ? null : t })}>{t}</button
				>
			{/each}
		</span>
	{/if}
{/snippet}

{#snippet line(r: Row, isPast: boolean)}
	<li class="flex items-center gap-3 py-1 pl-3">
		<span class="w-10 shrink-0 text-xs text-muted-foreground tabular-nums">
			P{r.periodFrom}{#if r.periodTo !== r.periodFrom}–{r.periodTo}{/if}
		</span>
		<ClassChip label={r.classLabel} tone={r.tone} />
		<div class="min-w-0 flex-1 py-1.5">
			<button
				type="button"
				class="text-left text-sm font-medium hover:underline {r.lesson
					? ''
					: 'font-normal text-muted-foreground italic'}"
				onclick={() => openSession(r)}>{r.lesson?.title ?? 'Open Slot'}</button
			>
			{@render tags(r)}
		</div>
		{#if r.lesson && !isPast}<Tick row={r} />{/if}
	</li>
{/snippet}

<div class="mx-auto max-w-3xl px-4 py-6 md:px-6">
	<div class="flex flex-wrap items-center gap-2">
		<h1 class="hidden text-xl font-semibold md:block">Agenda</h1>
		{#if tag}
			<span
				class="inline-flex h-8 items-center gap-1 rounded-full bg-primary pr-1 pl-3 text-xs font-medium text-primary-foreground"
			>
				Only “{tag}”
				<button
					type="button"
					class="rounded-full p-1 hover:bg-white/20"
					aria-label="Clear the Tag filter"
					onclick={() => set({ tag: null })}><XIcon class="size-3.5" /></button
				>
			</span>
		{:else}
			<span class="text-xs text-muted-foreground">Click a Tag to show only its Lessons.</span>
		{/if}
		<button
			type="button"
			class="ml-auto h-9 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted"
			onclick={() => set({ past: past ? null : '1' })}
			>{past ? 'Hide the past 7 days' : 'Past 7 days'}</button
		>
	</div>

	{#if past}
		<section class="mt-4 rounded-xl bg-muted/50 p-2">
			{#each v.pastDays as day (day.date)}
				<h2 class="px-3 pt-2 text-xs font-semibold text-muted-foreground">
					{formatWeekday(day.date)}
				</h2>
				<ul>
					{#each day.rows as r (r.key)}{@render line(r, true)}{/each}
				</ul>
			{/each}
		</section>
	{/if}

	{#if lead}
		<section class="mt-5">
			<h2 class="text-lg font-semibold">
				{lead.date === TODAY ? 'Today' : formatWeekday(lead.date)}
				{#if lead.date === TODAY}<span class="text-sm font-normal text-muted-foreground"
						>{formatWeekday(lead.date)}</span
					>{/if}
			</h2>
			<div class="mt-3 grid gap-3 sm:grid-cols-2">
				{#each lead.rows as r (r.key)}
					{@const t = classTone(r.tone)}
					<article
						class="flex flex-col rounded-xl border bg-card p-4"
						style:border-top={`4px solid ${t.ring}`}
					>
						<div class="flex items-center gap-2 text-xs text-muted-foreground">
							<span class="font-semibold text-foreground tabular-nums"
								>P{r.periodFrom}{#if r.periodTo !== r.periodFrom}–{r.periodTo}{/if}</span
							>
							<ClassChip label={r.classLabel} tone={r.tone} />
						</div>
						<button
							type="button"
							class="mt-2 text-left text-base leading-snug font-semibold hover:underline {r.lesson
								? ''
								: 'font-normal text-muted-foreground italic'}"
							onclick={() => openSession(r)}>{r.lesson?.title ?? 'Open Slot'}</button
						>
						{#if r.lesson}
							<p class="text-xs text-muted-foreground">
								{r.lesson.topicName ?? 'Standalone Lesson'}
							</p>
							{@render tags(r)}
						{/if}
						<div class="mt-auto flex items-center gap-2 pt-3">
							{#if r.lesson}<Tick row={r} labelled />{/if}
							<button
								type="button"
								class="ml-auto h-11 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted md:h-8 md:text-xs"
								onclick={() => openSession(r)}>{r.lesson ? 'Notes' : 'Plan'}</button
							>
						</div>
					</article>
				{/each}
			</div>
		</section>
	{:else}
		<p class="mt-6 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
			Nothing coming up{tag ? ` with the Tag “${tag}”` : ''}.
		</p>
	{/if}

	{#if rest.length}
		<h2 class="mt-8 text-sm font-semibold text-muted-foreground">Coming up</h2>
		<div class="mt-2 divide-y rounded-xl border bg-card">
			{#each rest as day, i (day.date)}
				{@const lessons = day.rows.filter((r) => r.lesson)}
				{@const ready = lessons.filter(isReady).length}
				{@const open = day.rows.length - lessons.length}
				<details open={i < 2} class="group">
					<summary
						class="flex h-12 cursor-pointer list-none items-center gap-2 px-3 text-sm select-none hover:bg-muted/40"
					>
						<ChevronDownIcon
							class="size-4 -rotate-90 text-muted-foreground transition-transform group-open:rotate-0"
						/>
						<span class="font-medium">{formatShortWeekday(day.date)}</span>
						<span class="text-xs text-muted-foreground">
							{day.rows.length} Session{day.rows.length === 1 ? '' : 's'}
						</span>
						<span class="ml-auto flex items-center gap-2 text-xs">
							{#if open}<span class="text-amber-600">{open} Open Slot{open === 1 ? '' : 's'}</span
								>{/if}
							<span class={ready === lessons.length ? 'text-primary' : 'text-muted-foreground'}
								>{ready}/{lessons.length} ready</span
							>
						</span>
					</summary>
					<ul class="pb-2">
						{#each day.rows as r (r.key)}{@render line(r, false)}{/each}
					</ul>
				</details>
			{/each}
		</div>
	{/if}

	{#if nextHorizon}
		<button
			type="button"
			class="mt-4 h-11 w-full rounded-xl border border-dashed text-sm font-medium text-muted-foreground hover:bg-muted md:h-9"
			onclick={() => set({ horizon: nextHorizon[0] })}
		>
			Show more days ({nextHorizon[1]})
		</button>
	{/if}
</div>
