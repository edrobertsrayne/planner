<!--
	PROTOTYPE ONLY (issue #310). Variant B: a week board. From `lg` each school week is five day
	columns of Session cards, today marked. Below `lg` a strip of day buttons picks one day, shown
	as a list. The Tag filter is a "Tags" button that opens a short list; the Tag in use shows as a
	pill you can clear. The look-back is "Last week" in the strip and the board.
-->
<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import TagIcon from '@lucide/svelte/icons/tag';
	import XIcon from '@lucide/svelte/icons/x';
	import { page } from '$app/state';
	import { classTone } from '$lib/class-tone';
	import { addDays, formatShortWeekday, formatWeekday, weekday } from '$lib/date';
	import TagChips from '$lib/components/tag-chips.svelte';
	import * as Popover from '$lib/components/ui/popover';
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
		tagCount,
		tagParam,
		view,
		type Row
	} from './store.svelte';

	const horizon = $derived(horizonParam());
	const tag = $derived(tagParam());
	const past = $derived(pastParam());
	const v = $derived(view(horizon, tag, past));
	const allDays = $derived([...v.pastDays, ...v.days]);

	// Weeks keyed by their Monday, each with five dates whether taught or not.
	const weeks = $derived.by(() => {
		const byDate = new Map(allDays.map((d) => [d.date, d.rows]));
		const mondays = [...new Set(allDays.map((d) => addDays(d.date, 1 - weekday(d.date))))];
		return mondays.map((m) => ({
			monday: m,
			days: [0, 1, 2, 3, 4].map((i) => {
				const date = addDays(m, i);
				return { date, rows: byDate.get(date) ?? [] };
			})
		}));
	});

	const chosenDay = $derived(
		page.url.searchParams.get('day') ??
			v.days.find((d) => d.date >= TODAY)?.date ??
			allDays[0]?.date ??
			TODAY
	);
	const chosenRows = $derived(allDays.find((d) => d.date === chosenDay)?.rows ?? []);
	let tagsOpen = $state(false);
</script>

{#snippet card(r: Row)}
	{@const t = classTone(r.tone)}
	{@const isPast = r.date < TODAY}
	<div
		class="flex items-start gap-1 rounded-lg border-l-4 bg-card p-2 shadow-xs ring-1 ring-border {isPast
			? 'opacity-70'
			: ''}"
		style:border-left-color={t.ring}
	>
		<button
			type="button"
			class="min-w-0 flex-1 text-left outline-none focus-visible:underline"
			onclick={() => openSession(r)}
		>
			<span class="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
				P{r.periodFrom}{#if r.periodTo !== r.periodFrom}–{r.periodTo}{/if}
				<ClassChip label={r.classLabel} tone={r.tone} />
			</span>
			{#if r.lesson}
				<span class="mt-1 block text-sm leading-snug font-medium">{r.lesson.title}</span>
				<TagChips tags={r.lesson.tags} class="mt-1" />
			{:else}
				<span class="mt-1 block text-sm text-muted-foreground italic">Open Slot</span>
			{/if}
		</button>
		{#if r.lesson && !isPast}<Tick row={r} />{/if}
	</div>
{/snippet}

{#snippet controls()}
	<div class="flex flex-wrap items-center gap-2">
		<Popover.Root bind:open={tagsOpen}>
			<Popover.Trigger
				class="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted md:h-8"
			>
				<TagIcon class="size-3.5" /> Tags
			</Popover.Trigger>
			<Popover.Content class="w-60 p-1" align="start">
				{#each v.tags as t (t)}
					<button
						type="button"
						class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
						onclick={() => {
							set({ tag: tag === t ? null : t });
							tagsOpen = false;
						}}
					>
						<CheckIcon class="size-4 {tag === t ? '' : 'invisible'}" />
						<span class="flex-1">{t}</span>
						<span class="text-xs text-muted-foreground tabular-nums"
							>{tagCount([...v.back, ...v.ahead], t)}</span
						>
					</button>
				{/each}
			</Popover.Content>
		</Popover.Root>
		{#if tag}
			<span
				class="inline-flex h-8 items-center gap-1 rounded-full bg-primary pr-1 pl-3 text-xs font-medium text-primary-foreground"
			>
				{tag}
				<button
					type="button"
					class="rounded-full p-1 hover:bg-white/20"
					aria-label="Clear the Tag filter"
					onclick={() => set({ tag: null })}><XIcon class="size-3.5" /></button
				>
			</span>
		{/if}
		<select
			class="h-9 rounded-md border bg-background px-2 text-sm md:h-8"
			aria-label="How far ahead"
			value={horizon}
			onchange={(e) => set({ horizon: e.currentTarget.value })}
		>
			{#each HORIZONS as [key, name] (key)}<option value={key}>{name}</option>{/each}
		</select>
	</div>
{/snippet}

<div class="px-4 py-6 md:px-6">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="hidden text-xl font-semibold md:block">Agenda</h1>
			<p class="text-sm text-muted-foreground">Your week, a column a day.</p>
		</div>
		{@render controls()}
	</div>

	<!-- Below lg: a day strip, then the chosen day. -->
	<div class="lg:hidden">
		<div class="-mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 pb-2">
			<button
				type="button"
				class="flex h-14 shrink-0 flex-col items-center justify-center rounded-lg border px-3 text-xs text-muted-foreground {past
					? 'bg-muted'
					: ''}"
				onclick={() => set({ past: past ? null : '1', day: null })}
			>
				Last<br />week
			</button>
			{#each allDays as d (d.date)}
				{@const on = d.date === chosenDay}
				{@const todo = d.rows.filter((r) => r.date >= TODAY && r.lesson && !isReady(r)).length}
				<button
					type="button"
					class="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border text-xs {on
						? 'border-primary bg-primary text-primary-foreground'
						: d.date < TODAY
							? 'bg-muted/60 text-muted-foreground'
							: ''}"
					onclick={() => set({ day: d.date })}
					{@attach (el) => {
						if (on) el.scrollIntoView({ inline: 'center', block: 'nearest' });
					}}
				>
					<span class="font-medium">{formatShortWeekday(d.date).split(' ')[0]}</span>
					<span class="tabular-nums">{d.date.slice(8)}</span>
					{#if todo > 0}<span class="mt-0.5 size-1.5 rounded-full bg-amber-500"></span>{/if}
				</button>
			{/each}
		</div>
		<h2 class="mt-3 text-sm font-semibold">
			{chosenDay === TODAY ? 'Today — ' : ''}{formatWeekday(chosenDay)}
		</h2>
		<div class="mt-2 space-y-2">
			{#each chosenRows as r (r.key)}{@render card(r)}{:else}
				<p class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
					Nothing on this day{tag ? ` with the Tag “${tag}”` : ''}.
				</p>
			{/each}
		</div>
	</div>

	<!-- lg and up: the board. -->
	<div class="hidden lg:block">
		<button
			type="button"
			class="mt-4 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
			onclick={() => set({ past: past ? null : '1' })}
		>
			{past ? 'Hide last week' : 'Show last week'}
		</button>
		{#each weeks as w (w.monday)}
			<section class="mt-4">
				<h2 class="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
					Week of {formatWeekday(w.monday)}
				</h2>
				<div class="grid grid-cols-5 gap-2">
					{#each w.days as d (d.date)}
						<div
							class="min-h-24 rounded-xl p-1.5 {d.date === TODAY
								? 'bg-primary/10 ring-2 ring-primary'
								: d.date < TODAY
									? 'bg-muted/70'
									: 'bg-muted/30'}"
						>
							<p class="mb-1.5 px-1 text-xs font-semibold">
								{d.date === TODAY ? 'Today' : formatShortWeekday(d.date)}
							</p>
							<div class="space-y-1.5">
								{#each d.rows as r (r.key)}{@render card(r)}{/each}
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</div>
