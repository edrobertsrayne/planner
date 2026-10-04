<!--
	PROTOTYPE ONLY (issue #310). Variant C: a filter rail and a table. From `lg` a narrow rail at the
	left holds the horizon, the look-back and every Tag as a list with counts; the Agenda is a table
	with a sticky heading row per day. Below `lg` the rail moves into a "Filters" sheet (from the
	bottom on a phone) and each row is a compact card.
-->
<script lang="ts">
	import SlidersIcon from '@lucide/svelte/icons/sliders-horizontal';
	import { formatWeekday } from '$lib/date';
	import TagChips from '$lib/components/tag-chips.svelte';
	import * as Sheet from '$lib/components/ui/sheet';
	import ClassChip from '../planning/prototype/ClassChip.svelte';
	import Tick from './Tick.svelte';
	import {
		HORIZONS,
		TODAY,
		horizonParam,
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
	const all = $derived([...v.back, ...v.ahead]);
	let width = $state(0);
	const wide = $derived(width >= 768);
	let sheet = $state(false);
	const active = $derived((tag ? 1 : 0) + (past ? 1 : 0) + (horizon !== '7' ? 1 : 0));
</script>

{#snippet option(on: boolean, label: string, count: number | null, onclick: () => void)}
	<button
		type="button"
		aria-pressed={on}
		class="flex h-11 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm lg:h-8 {on
			? 'bg-muted font-medium text-foreground'
			: 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
		{onclick}
	>
		<span class="flex-1 truncate">{label}</span>
		{#if count !== null}<span class="text-xs tabular-nums opacity-70">{count}</span>{/if}
	</button>
{/snippet}

{#snippet filters()}
	<div class="space-y-5">
		<div>
			<p class="mb-1 px-2.5 text-xs font-semibold text-muted-foreground">Show</p>
			{#each HORIZONS as [key, name] (key)}
				{@render option(horizon === key, name, null, () => set({ horizon: key }))}
			{/each}
		</div>
		<label class="flex h-11 items-center gap-2 px-2.5 text-sm lg:h-8">
			<input
				type="checkbox"
				checked={past}
				onchange={(e) => set({ past: e.currentTarget.checked ? '1' : null })}
			/>
			Previous 7 days
		</label>
		<div>
			<p class="mb-1 px-2.5 text-xs font-semibold text-muted-foreground">Tags</p>
			{@render option(!tag, 'All Lessons', null, () => set({ tag: null }))}
			{#each v.tags as t (t)}
				{@render option(tag === t, t, tagCount(all, t), () => set({ tag: tag === t ? null : t }))}
			{/each}
		</div>
	</div>
{/snippet}

<svelte:window bind:innerWidth={width} />

<div class="flex gap-6 px-4 py-6 md:px-6">
	<aside class="sticky top-6 hidden w-48 shrink-0 self-start lg:block">
		<h1 class="mb-4 px-2.5 text-xl font-semibold">Agenda</h1>
		{@render filters()}
	</aside>

	<div class="min-w-0 flex-1">
		<div class="flex items-center gap-2 lg:hidden">
			<h1 class="hidden text-xl font-semibold md:block">Agenda</h1>
			{#if tag}<span class="text-sm text-muted-foreground">· {tag}</span>{/if}
			<Sheet.Root bind:open={sheet}>
				<Sheet.Trigger
					class="ml-auto inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted"
				>
					<SlidersIcon class="size-4" /> Filters
					{#if active}<span
							class="rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums"
							>{active}</span
						>{/if}
				</Sheet.Trigger>
				<Sheet.Content side={wide ? 'right' : 'bottom'} class="max-h-[85vh] overflow-y-auto p-4">
					<Sheet.Header class="p-0"><Sheet.Title>Filters</Sheet.Title></Sheet.Header>
					{@render filters()}
				</Sheet.Content>
			</Sheet.Root>
		</div>

		<!-- md and up: a table with a heading row per day. -->
		<table class="mt-2 hidden w-full text-sm md:table lg:mt-0">
			{#each [...v.pastDays, ...v.days] as day (day.date)}
				{@const isPast = day.date < TODAY}
				<tbody class={isPast ? 'bg-muted/50' : ''}>
					<tr class="sticky top-0 z-10 bg-background">
						<th colspan="5" class="border-b pt-5 pb-1.5 text-left text-sm font-semibold">
							{#if day.date === TODAY}Today <span class="font-normal text-muted-foreground"
									>— {formatWeekday(day.date)}</span
								>{:else}<span class="text-muted-foreground">{formatWeekday(day.date)}</span>{/if}
						</th>
					</tr>
					{#each day.rows as r (r.key)}
						{@render tableRow(r, isPast)}
					{/each}
				</tbody>
			{/each}
		</table>

		<!-- Phone: compact cards under day headings. -->
		<div class="md:hidden">
			{#each [...v.pastDays, ...v.days] as day (day.date)}
				<h2
					class="sticky top-(--shell-top) z-10 -mx-4 mt-3 border-b bg-background px-4 py-2 text-sm font-semibold {day.date ===
					TODAY
						? ''
						: 'text-muted-foreground'}"
				>
					{day.date === TODAY ? 'Today — ' : ''}{formatWeekday(day.date)}
				</h2>
				<ul class="divide-y">
					{#each day.rows as r (r.key)}
						<li class="flex items-center gap-2 py-1 {day.date < TODAY ? 'opacity-70' : ''}">
							<button
								type="button"
								class="min-w-0 flex-1 py-1.5 text-left"
								onclick={() => openSession(r)}
							>
								<span class="flex items-center gap-1.5 text-xs text-muted-foreground">
									P{r.periodFrom}{#if r.periodTo !== r.periodFrom}–{r.periodTo}{/if}
									<ClassChip label={r.classLabel} tone={r.tone} />
								</span>
								<span
									class="mt-0.5 block text-sm font-medium {r.lesson
										? ''
										: 'font-normal text-muted-foreground italic'}"
									>{r.lesson?.title ?? 'Open Slot'}</span
								>
							</button>
							{#if r.lesson && day.date >= TODAY}<Tick row={r} />{/if}
						</li>
					{/each}
				</ul>
			{/each}
		</div>
	</div>
</div>

{#snippet tableRow(r: Row, isPast: boolean)}
	<tr class="border-b align-top hover:bg-muted/40">
		<td class="w-16 py-2 pr-3 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
			P{r.periodFrom}{#if r.periodTo !== r.periodFrom}–{r.periodTo}{/if}
		</td>
		<td class="w-16 py-2 pr-3"><ClassChip label={r.classLabel} tone={r.tone} /></td>
		<td class="py-2 pr-3">
			<button type="button" class="text-left hover:underline" onclick={() => openSession(r)}>
				{#if r.lesson}
					<span class="font-medium">{r.lesson.title}</span>
				{:else}
					<span class="text-muted-foreground italic">Open Slot — plan it</span>
				{/if}
			</button>
			{#if r.lesson}
				<div class="text-xs text-muted-foreground">{r.lesson.topicName ?? 'Standalone Lesson'}</div>
				<TagChips tags={r.lesson.tags} class="mt-1 xl:hidden" />
			{/if}
		</td>
		<td class="hidden w-40 py-2 pr-3 xl:table-cell">
			{#if r.lesson}<TagChips tags={r.lesson.tags} />{/if}
		</td>
		<td class="w-10 py-0.5 text-right">
			{#if r.lesson && !isPast}<Tick row={r} />{/if}
		</td>
	</tr>
{/snippet}
