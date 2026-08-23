<!--
	PROTOTYPE — throwaway. C — The briefing.

	The screen answers "what is next" first and "what is coming" second. Next up is a single large
	card; the rest of today is a short list beneath it; everything after today collapses to a dense
	strip of one row per day carrying tone chips only.

	The structural claim is that the horizon control is a symptom, not a feature — the reason to
	pick "3 days" over "Week" is that the list gets unreadable, and a screen that separates *now*
	from *ahead* by shape doesn't need the user to tune it. So this variant deliberately ships no
	horizon control at all: the strip always runs to the end of the fortnight, and gets shorter on
	its own as the term does. If the pills are missed here, that is the finding.
-->
<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import PageHeader from './PageHeader.svelte';
	import { tone } from './tone.js';
	import { PERIOD_TIMES, type AgendaRow } from './fixtures.js';

	let { rows, today }: { rows: AgendaRow[]; today: string } = $props();

	const todayRows = $derived(rows.filter((r) => r.date === today));
	const next = $derived(todayRows[0] ?? rows[0] ?? null);
	const restOfToday = $derived(todayRows.slice(next && next.date === today ? 1 : 0));
	const ahead = $derived.by(() => {
		const out: { date: string; rows: AgendaRow[] }[] = [];
		for (const row of rows.filter((r) => r.date > today)) {
			const last = out[out.length - 1];
			if (last && last.date === row.date) last.rows.push(row);
			else out.push({ date: row.date, rows: [row] });
		}
		return out;
	});

	const fmtDay = (iso: string) =>
		new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
			weekday: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		});
	const fmtLong = (iso: string) =>
		new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			timeZone: 'UTC'
		});
</script>

<div class="mx-auto max-w-3xl px-6 py-6">
	<PageHeader title="Agenda" description={fmtLong(today)} />

	{#if !next}
		<div class="rounded-xl border border-dashed px-6 py-12 text-center">
			<p class="text-sm font-medium">Nothing ahead</p>
			<p class="mt-1 text-sm text-muted-foreground">
				No Class is timetabled in the next fortnight.
			</p>
		</div>
	{:else}
		{@const t = tone(next.tone)}
		<p class="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
			{next.date === today ? 'Next up' : 'Next — ' + fmtLong(next.date)}
		</p>

		<button
			type="button"
			data-session-trigger
			class="block w-full rounded-xl border bg-card p-5 text-left hover:bg-muted/30"
			style:border-top="3px solid {t.ring}"
		>
			<div class="flex items-start gap-3">
				<span
					class="shrink-0 rounded-lg px-2.5 py-1 text-sm font-semibold"
					style:background-color={t.bg}
					style:color={t.fg}
				>
					{next.classLabel}
				</span>
				<div class="min-w-0 flex-1">
					<p class="text-base font-semibold">
						{next.lesson?.title ?? 'Unplanned'}
					</p>
					<p class="mt-0.5 text-sm text-muted-foreground">
						{#if next.lesson}{next.lesson.topicName} ·
						{/if}P{next.periodFrom}{#if next.periodTo !== next.periodFrom}–{next.periodTo}{/if} at {PERIOD_TIMES[
							next.periodFrom
						]} · {next.room}
					</p>
				</div>
				{#if !next.lesson}
					<Button size="sm" class="h-7 shrink-0">Plan it</Button>
				{/if}
			</div>
		</button>

		{#if restOfToday.length > 0}
			<p class="mt-6 mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
				Later today
			</p>
			<ul class="divide-y divide-border overflow-hidden rounded-xl border bg-card">
				{#each restOfToday as row (row.classId + row.periodFrom)}
					{@const rt = tone(row.tone)}
					<li>
						<button
							type="button"
							data-session-trigger
							class="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-muted/40"
						>
							<span class="w-12 shrink-0 text-xs text-muted-foreground tabular-nums">
								{PERIOD_TIMES[row.periodFrom]}
							</span>
							<span
								class="h-5 shrink-0 rounded-2xl px-2 py-0.5 text-xs font-medium"
								style:background-color={rt.bg}
								style:color={rt.fg}
							>
								{row.classLabel}
							</span>
							<span class="min-w-0 flex-1 truncate">
								{#if row.lesson}{row.lesson.title}{:else}<span class="text-muted-foreground italic"
										>Unplanned</span
									>{/if}
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if ahead.length > 0}
			<Separator class="my-6" />
			<p class="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Ahead</p>
			<div class="overflow-hidden rounded-xl border bg-card">
				{#each ahead as day (day.date)}
					<div class="flex items-center gap-3 border-b px-4 py-1.5 last:border-b-0">
						<span class="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">
							{fmtDay(day.date)}
						</span>
						<div class="flex min-w-0 flex-1 flex-wrap gap-1">
							{#each day.rows as row (row.classId + row.periodFrom)}
								{@const at = tone(row.tone)}
								<button
									type="button"
									data-session-trigger
									title="P{row.periodFrom} · {row.lesson?.title ?? 'Unplanned'}"
									class="h-5 rounded-2xl px-2 text-xs font-medium {row.lesson
										? ''
										: 'border border-dashed'}"
									style:background-color={row.lesson ? at.bg : 'transparent'}
									style:color={row.lesson ? at.fg : at.ring}
									style:border-color={at.ring}
								>
									{row.classLabel}
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
