<!--
	PROTOTYPE ONLY (issue #312). The Calendar's heading and week controls. From `md` it is today's
	header: arrows, Today, the five-week ribbon and Set up year. Below `md` the ribbon does not fit,
	so the arrows frame one label ("Week A · w/c 5 Oct") with Today beside it, and Set up year is
	gone: the calendar is not written on a phone.
-->
<script lang="ts">
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { formatDayMonth } from '$lib/date';
	import { CURRENT, WEEKS, set, weekIndex, weekParam } from './store.svelte';

	const selected = $derived(weekParam());
	const i = $derived(weekIndex(selected));
	const prev = $derived(WEEKS[i - 1]?.weekCommencing ?? null);
	const next = $derived(WEEKS[i + 1]?.weekCommencing ?? null);
	const ribbon = $derived(WEEKS.slice(Math.max(0, i - 2), i + 3));
	const go = (w: string | null) => w && set({ week: w === CURRENT ? null : w, day: null });
</script>

<div class="flex flex-wrap items-center justify-between gap-3">
	<h1 class="hidden text-xl font-semibold md:block">Calendar</h1>

	<!-- Below md: one label between two 44 px arrows. -->
	<div class="flex w-full items-center gap-1 md:hidden">
		<button
			type="button"
			class="inline-flex size-11 items-center justify-center rounded-md hover:bg-muted disabled:opacity-40"
			disabled={!prev}
			aria-label="Previous Teaching Week"
			onclick={() => go(prev)}><ChevronLeftIcon class="size-5" /></button
		>
		<div class="flex-1 text-center">
			<div class="text-sm font-semibold">Week {WEEKS[i].letter}</div>
			<div class="text-xs text-muted-foreground">w/c {formatDayMonth(selected)}</div>
		</div>
		<button
			type="button"
			class="inline-flex size-11 items-center justify-center rounded-md hover:bg-muted disabled:opacity-40"
			disabled={!next}
			aria-label="Next Teaching Week"
			onclick={() => go(next)}><ChevronRightIcon class="size-5" /></button
		>
		<Button
			size="sm"
			class="ml-1 h-11 px-4"
			disabled={selected === CURRENT}
			onclick={() => go(CURRENT)}>Today</Button
		>
	</div>

	<!-- From md: today's header. -->
	<div class="hidden items-center gap-2 md:flex">
		<Button
			variant="ghost"
			size="icon-sm"
			disabled={!prev}
			aria-label="Previous Teaching Week"
			onclick={() => go(prev)}><ChevronLeftIcon /></Button
		>
		<Button size="sm" class="h-7" disabled={selected === CURRENT} onclick={() => go(CURRENT)}
			>Today</Button
		>
		<div class="flex items-center gap-0.5 rounded-md border p-0.5">
			{#each ribbon as w (w.weekCommencing)}
				{@const on = w.weekCommencing === selected}
				<button
					type="button"
					aria-current={on ? 'true' : undefined}
					class="flex h-6 items-center rounded-sm px-2 text-xs font-medium tabular-nums {on
						? 'bg-secondary text-secondary-foreground'
						: 'text-muted-foreground hover:bg-muted'}"
					onclick={() => go(w.weekCommencing)}
				>
					{w.letter}<span class="ml-1 font-normal opacity-70"
						>{formatDayMonth(w.weekCommencing)}</span
					>
				</button>
			{/each}
		</div>
		<Button
			variant="ghost"
			size="icon-sm"
			disabled={!next}
			aria-label="Next Teaching Week"
			onclick={() => go(next)}><ChevronRightIcon /></Button
		>
		<Button
			size="sm"
			variant="ghost"
			class="h-7"
			onclick={() => toast('Set up year is not part of this prototype.')}>Set up year</Button
		>
	</div>
</div>
