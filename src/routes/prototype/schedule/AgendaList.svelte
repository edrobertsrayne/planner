<!-- PROTOTYPE — throwaway. The Agenda's chronological list, restyled on rhea/shadcn. Reused by
     every variant so the list itself isn't what's being compared — the surrounding shape is. -->
<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { classTone } from '$lib/client/class-tone';
	import { sessionPanel } from '$lib/client/session-panel.svelte';
	import type { agenda } from '$lib/server/planner';

	type AgendaRow = ReturnType<typeof agenda>[number];

	let {
		rows,
		today,
		dense = false
	}: { rows: AgendaRow[]; today: string; dense?: boolean } = $props();

	const fmtLongDay = (iso: string) =>
		new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			timeZone: 'UTC'
		});

	const days = $derived.by(() => {
		const out: { date: string; rows: AgendaRow[] }[] = [];
		for (const row of rows) {
			const last = out[out.length - 1];
			if (last && last.date === row.date) last.rows.push(row);
			else out.push({ date: row.date, rows: [row] });
		}
		return out;
	});
</script>

{#if days.length === 0}
	<p class="text-sm text-muted-foreground">Nothing in this window — no Class is timetabled here.</p>
{/if}

{#each days as day (day.date)}
	{@const isToday = day.date === today}
	<section class={dense ? 'mb-4' : 'mb-6'}>
		<h2 class="mb-2 text-sm font-semibold {isToday ? 'text-foreground' : 'text-muted-foreground'}">
			{isToday ? 'Today — ' : ''}{fmtLongDay(day.date)}
		</h2>
		<ul class="divide-y divide-border overflow-hidden rounded-lg border bg-card">
			{#each day.rows as row (row.classId + row.periodFrom)}
				{@const tone = classTone(row.classId)}
				<li>
					<button
						type="button"
						class="flex w-full gap-3 px-4 {dense
							? 'py-2'
							: 'py-3'} text-left text-sm hover:bg-muted/50"
						onclick={() =>
							sessionPanel.open({ classId: row.classId, date: row.date, period: row.periodFrom })}
					>
						<span class="w-14 shrink-0 font-mono text-xs text-muted-foreground">
							P{row.periodFrom}{#if row.periodTo !== row.periodFrom}–{row.periodTo}{/if}
						</span>
						<Badge variant="outline" class="h-fit shrink-0 {tone.bg} {tone.text}">
							{row.classLabel}
						</Badge>
						<span class="min-w-0 flex-1">
							{#if row.lesson}
								<span class="font-medium">{row.lesson.title}</span>
								<span class="block text-xs text-muted-foreground">{row.lesson.topicName}</span>
							{:else}
								<span class="text-muted-foreground italic">Unplanned</span>
							{/if}
						</span>
					</button>
				</li>
			{/each}
		</ul>
	</section>
{/each}
