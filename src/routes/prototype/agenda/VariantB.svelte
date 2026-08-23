<!--
	PROTOTYPE — throwaway. B — The spine.

	One continuous scroll with no per-day container. A period gutter runs down the left as a spine
	and every period is on it, taught or not — so a free P2 is a visible gap rather than an absence
	you have to infer from a jump in the numbers. Day boundaries are sticky rules, not cards.

	The structural claim is the opposite of A's: the unit is the *period*, the day is only a
	divider, and the shape of a day (where the frees fall, where the doubles are) is information
	the Agenda should carry. Horizon shrinks to a Select in the header, because on this shape the
	window matters less — the scroll is continuous either way.
-->
<script lang="ts">
	import * as Select from '$lib/components/ui/select/index.js';
	import PageHeader from './PageHeader.svelte';
	import { tone } from './tone.js';
	import { HORIZONS, PERIODS, PERIOD_TIMES, withinHorizon, type AgendaRow } from './fixtures.js';

	let {
		rows,
		today,
		horizon = $bindable(7)
	}: { rows: AgendaRow[]; today: string; horizon: number } = $props();

	const visible = $derived(withinHorizon(rows, today, horizon));

	const fmtDay = (iso: string) =>
		new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			timeZone: 'UTC'
		});

	/* Every period of every day that has anything on it — including the frees between, which is
	   the whole point of this variant. Days with nothing at all are still dropped. */
	const days = $derived.by(() => {
		const byDate: { date: string; rows: AgendaRow[] }[] = [];
		for (const row of visible) {
			const last = byDate[byDate.length - 1];
			if (last && last.date === row.date) last.rows.push(row);
			else byDate.push({ date: row.date, rows: [row] });
		}
		return byDate.map(({ date, rows: dayRows }) => {
			const slots: { period: number; row: AgendaRow | null; span: number }[] = [];
			for (const period of PERIODS) {
				const covering = dayRows.find((r) => period >= r.periodFrom && period <= r.periodTo);
				if (covering && covering.periodFrom !== period) continue; // inside a double
				slots.push({
					period,
					row: covering ?? null,
					span: covering ? covering.periodTo - covering.periodFrom + 1 : 1
				});
			}
			return { date, slots, taught: dayRows.length };
		});
	});
</script>

<div class="mx-auto max-w-3xl px-6 py-6">
	<PageHeader title="Agenda" description="Every period, in order — frees included.">
		{#snippet actions()}
			<Select.Root
				type="single"
				value={String(horizon)}
				onValueChange={(v) => {
					if (v) horizon = Number(v);
				}}
			>
				<Select.Trigger size="sm" class="w-36">
					{HORIZONS.find(([d]) => d === horizon)?.[1]}
				</Select.Trigger>
				<Select.Content>
					{#each HORIZONS as [days, label] (days)}
						<Select.Item value={String(days)} {label} />
					{/each}
				</Select.Content>
			</Select.Root>
		{/snippet}
	</PageHeader>

	{#if days.length === 0}
		<p class="py-12 text-center text-sm text-muted-foreground">
			Nothing timetabled in this window.
		</p>
	{/if}

	<div class="border-t">
		{#each days as day (day.date)}
			{@const isToday = day.date === today}
			<div
				class="sticky top-[57px] z-[5] flex items-baseline gap-2 border-b bg-background/95 py-1.5 backdrop-blur"
			>
				<span class="text-xs font-semibold {isToday ? 'text-foreground' : 'text-muted-foreground'}">
					{isToday ? 'Today' : fmtDay(day.date)}
				</span>
				<span class="text-xs text-muted-foreground">
					{day.taught}
					{day.taught === 1 ? 'period' : 'periods'}
				</span>
			</div>

			{#each day.slots as slot (slot.period)}
				<div class="flex items-stretch gap-3 border-b border-dashed last:border-solid">
					<div class="w-16 shrink-0 py-2 text-right text-xs text-muted-foreground tabular-nums">
						<span class="block font-medium">P{slot.period}</span>
						<span class="block">{PERIOD_TIMES[slot.period]}</span>
					</div>

					{#if slot.row}
						{@const t = tone(slot.row.tone)}
						<button
							type="button"
							data-session-trigger
							class="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-2 pr-2 pl-3 text-left hover:bg-muted/40"
							style:border-left="3px solid {t.ring}"
						>
							<span
								class="h-5 shrink-0 rounded-2xl px-2 py-0.5 text-xs font-medium"
								style:background-color={t.bg}
								style:color={t.fg}
							>
								{slot.row.classLabel}
							</span>
							<span class="min-w-0 flex-1 text-sm">
								{#if slot.row.lesson}
									<span class="block truncate font-medium">{slot.row.lesson.title}</span>
									<span class="block truncate text-xs text-muted-foreground">
										{slot.row.lesson.topicName}
									</span>
								{:else}
									<span class="text-muted-foreground italic">Unplanned</span>
								{/if}
							</span>
							{#if slot.span > 1}
								<span class="shrink-0 text-xs text-muted-foreground">double</span>
							{/if}
							<span class="shrink-0 text-xs text-muted-foreground">{slot.row.room}</span>
						</button>
					{:else}
						<div class="flex flex-1 items-center py-2">
							<span class="text-xs text-muted-foreground/60">Free</span>
						</div>
					{/if}
				</div>
			{/each}
		{/each}
	</div>
</div>
