<!--
	PROTOTYPE — throwaway. A — The list.

	Today's Agenda, kept and refined: a horizon control at the top, then one card per day holding
	that day's occasions as rows. The structural claim is that the *day* is the unit — every day in
	the window gets a heading and a container, whether it holds five lessons or one.

	Tone arrives as a left edge on the row plus the Class badge, which is the least the tone tokens
	can do; the row is otherwise on card/muted like everything else. Horizon is a ToggleGroup —
	the segmented control the pills were always imitating.
-->
<script lang="ts">
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import PageHeader from './PageHeader.svelte';
	import { tone } from './tone.js';
	import { HORIZONS, PERIOD_TIMES, withinHorizon, type AgendaRow } from './fixtures.js';

	let {
		rows,
		today,
		horizon = $bindable(7)
	}: { rows: AgendaRow[]; today: string; horizon: number } = $props();

	const visible = $derived(withinHorizon(rows, today, horizon));

	const fmtDay = (iso: string) =>
		new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			timeZone: 'UTC'
		});

	const days = $derived.by(() => {
		const out: { date: string; rows: AgendaRow[] }[] = [];
		for (const row of visible) {
			const last = out[out.length - 1];
			if (last && last.date === row.date) last.rows.push(row);
			else out.push({ date: row.date, rows: [row] });
		}
		return out;
	});
</script>

<div class="mx-auto max-w-3xl px-6 py-6">
	<PageHeader title="Agenda" description="What is coming up, in order.">
		{#snippet actions()}
			<ToggleGroup
				type="single"
				variant="outline"
				size="sm"
				value={String(horizon)}
				onValueChange={(v) => {
					if (v) horizon = Number(v);
				}}
			>
				{#each HORIZONS as [days, label] (days)}
					<ToggleGroupItem value={String(days)}>{label}</ToggleGroupItem>
				{/each}
			</ToggleGroup>
		{/snippet}
	</PageHeader>

	{#if days.length === 0}
		<div class="rounded-xl border border-dashed px-6 py-12 text-center">
			<p class="text-sm font-medium">Nothing in this window</p>
			<p class="mt-1 text-sm text-muted-foreground">
				No Class is timetabled between now and the end of the {HORIZONS.find(
					([d]) => d === horizon
				)?.[1].toLowerCase()}.
			</p>
		</div>
	{/if}

	{#each days as day (day.date)}
		{@const isToday = day.date === today}
		<section class="mb-6">
			<h2 class="mb-2 flex items-baseline gap-2 text-sm font-semibold">
				{#if isToday}<span class="text-foreground">Today</span><span class="text-muted-foreground"
						>— {fmtDay(day.date)}</span
					>
				{:else}<span class="text-muted-foreground">{fmtDay(day.date)}</span>{/if}
			</h2>

			<ul class="divide-y divide-border overflow-hidden rounded-xl border bg-card">
				{#each day.rows as row (row.classId + row.periodFrom)}
					{@const t = tone(row.tone)}
					<li class="group/row relative flex items-center gap-3 pr-3 pl-4 hover:bg-muted/40">
						<span
							class="absolute inset-y-0 left-0 w-1"
							style:background-color={t.ring}
							aria-hidden="true"
						></span>

						<span class="w-16 shrink-0 py-3 text-xs text-muted-foreground tabular-nums">
							{PERIOD_TIMES[row.periodFrom]}
							<span class="block">
								P{row.periodFrom}{#if row.periodTo !== row.periodFrom}–{row.periodTo}{/if}
							</span>
						</span>

						<span
							class="h-5 shrink-0 rounded-2xl px-2 py-0.5 text-xs font-medium"
							style:background-color={t.bg}
							style:color={t.fg}
						>
							{row.classLabel}
						</span>

						<button
							type="button"
							data-session-trigger
							class="min-w-0 flex-1 py-3 text-left text-sm outline-none focus-visible:underline"
						>
							{#if row.lesson}
								<span class="block truncate font-medium">{row.lesson.title}</span>
								<span class="block truncate text-xs text-muted-foreground">
									{row.lesson.topicName} · {row.room}
								</span>
							{:else}
								<span class="block text-muted-foreground italic">Unplanned</span>
								<span class="block text-xs text-muted-foreground">{row.room}</span>
							{/if}
						</button>

						{#if !row.lesson}
							<Button
								variant="ghost"
								size="sm"
								class="h-7 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
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
