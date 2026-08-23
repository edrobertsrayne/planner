<script lang="ts">
	import { goto } from '$app/navigation';
	import { sessionPanel } from '$lib/client/session-panel.svelte';
	import { AGENDA_HORIZONS } from './agenda-horizons';
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

	const days = $derived.by(() => {
		const out: { date: string; rows: (typeof data.rows)[number][] }[] = [];
		for (const row of data.rows) {
			const last = out[out.length - 1];
			if (last && last.date === row.date) last.rows.push(row);
			else out.push({ date: row.date, rows: [row] });
		}
		return out;
	});
</script>

<svelte:head><title>Agenda</title></svelte:head>

<div class="mx-auto max-w-3xl px-6 py-6">
	<div class="mb-5 flex items-center gap-2 text-sm">
		<span class="text-neutral-500">Show</span>
		{#each AGENDA_HORIZONS as [n, label] (n)}
			<button
				class="rounded-full px-3 py-1 {data.horizonDays === n
					? 'bg-neutral-900 text-white'
					: 'bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-100'}"
				onclick={() => setHorizon(n)}>{label}</button
			>
		{/each}
	</div>

	{#if days.length === 0}
		<p class="text-sm text-neutral-400">Nothing in this window — no Class is timetabled here.</p>
	{/if}

	{#each days as day (day.date)}
		{@const isToday = day.date === data.today}
		<section class="mb-6">
			<h2 class="mb-2 text-sm font-semibold {isToday ? 'text-neutral-900' : 'text-neutral-600'}">
				{isToday ? 'Today — ' : ''}{fmtLongDay(day.date)}
			</h2>
			<ul
				class="divide-y divide-neutral-100 overflow-hidden rounded-lg bg-white ring-1 ring-neutral-200"
			>
				{#each day.rows as row (row.classId + row.periodFrom)}
					<li>
						<button
							type="button"
							class="flex w-full gap-3 px-4 py-3 text-left text-sm hover:bg-neutral-50"
							onclick={() =>
								sessionPanel.open({
									classId: row.classId,
									date: row.date,
									period: row.periodFrom
								})}
						>
							<span class="w-14 shrink-0 font-mono text-xs text-neutral-400">
								P{row.periodFrom}{#if row.periodTo !== row.periodFrom}–{row.periodTo}{/if}
							</span>
							<span
								class="h-fit shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-semibold ring-1 ring-neutral-300"
							>
								{row.classLabel}
							</span>
							<span class="min-w-0 flex-1">
								{#if row.lesson}
									<span class="font-medium">{row.lesson.title}</span>
									<span class="block text-xs text-neutral-500">{row.lesson.topicName}</span>
								{:else}
									<span class="text-neutral-400 italic">Unplanned</span>
								{/if}
							</span>
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>
