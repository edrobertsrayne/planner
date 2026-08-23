<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { sessionPanel } from '$lib/client/session-panel.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
	const PERIODS = [1, 2, 3, 4, 5, 6];
	const WEEKS = ['A', 'B'] as const;

	let mode = $state<'year' | 'date'>('year');
	let fromDate = $state('');

	// Reset the local edit state whenever the server sends a new "changes apply from" — an
	// accepted edit, never a keystroke in the date input itself.
	$effect(() => {
		mode = data.effectiveFrom ? 'date' : 'year';
		fromDate = data.effectiveFrom ?? data.yearStart ?? '';
	});

	const effectiveFrom = $derived(mode === 'date' && fromDate ? fromDate : '');

	function applyEffective() {
		const params = [effectiveFrom && `from=${encodeURIComponent(effectiveFrom)}`].filter(Boolean);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- carries a query string
		goto(`?${params.join('&')}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
			invalidateAll: true
		});
	}

	function slotAt(week: (typeof WEEKS)[number], day: number, period: number) {
		return data.grid.find((s) => s.week === week && s.day === day && s.period === period) ?? null;
	}

	const fmtLong = (iso: string) =>
		new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		});

	let topicToAssign = $state('');
	$effect(() => {
		if (!data.courseTopics.some((t) => t.id === topicToAssign))
			topicToAssign = data.courseTopics[0]?.id ?? '';
	});
</script>

<svelte:head><title>{data.class.label}</title></svelte:head>

<div class="min-w-0 flex-1 overflow-y-auto">
	<div class="border-b border-neutral-200 bg-white px-8 py-5">
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- static internal route -->
		<a href="/classes" class="text-xs text-neutral-400 hover:text-neutral-700">&larr; Classes</a>
		<div class="mt-1 flex items-baseline gap-3">
			<h2 class="text-xl font-semibold tracking-tight">{data.class.label}</h2>
			<span class="rounded bg-neutral-100 px-2 py-0.5 text-xs ring-1 ring-neutral-300"
				>{data.class.courseName}</span
			>
		</div>
		<p class="mt-1 text-xs text-neutral-400">
			The Course is fixed at creation and cannot be changed here — a mis-pick means deleting the
			Class and starting again.
		</p>
	</div>

	{#if data.lane}
		<section class="border-b border-neutral-200 bg-white px-8 py-4">
			<div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
				<span class="text-neutral-600">
					{data.lane.taught} / {data.lane.total} Lessons taught
				</span>
				<span class="text-neutral-600">
					Runway:
					<span class="font-medium text-neutral-900"
						>{data.lane.runway.date ? fmtLong(data.lane.runway.date) : 'open-ended'}</span
					>
					{#if data.lane.runway.lessonsRemaining > 0}
						<span class="text-neutral-400"
							>({data.lane.runway.lessonsRemaining} Lesson{data.lane.runway.lessonsRemaining === 1
								? ''
								: 's'} with no Slot left to carry them)</span
						>
					{/if}
				</span>
			</div>
			<div class="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-xs">
				{#if data.lane.lastTaught}
					{@const lt = data.lane.lastTaught}
					<button
						type="button"
						class="text-left text-neutral-600 hover:text-neutral-900"
						onclick={() =>
							sessionPanel.open({ classId: data.class.id, date: lt.date, period: lt.period })}
					>
						<span class="text-neutral-400">Last taught:</span>
						<span class="font-medium">{lt.title}</span>
						{#if lt.note}<span class="text-neutral-400"> — {lt.note}</span>{/if}
					</button>
				{:else}
					<span class="text-neutral-400">Not taught yet.</span>
				{/if}
				{#if data.lane.nextUp}
					<span class="text-neutral-600">
						<span class="text-neutral-400">Next up:</span>
						<span class="font-medium">{data.lane.nextUp.title}</span>
					</span>
				{/if}
			</div>
		</section>
	{/if}

	<section class="px-8 py-6">
		<div class="flex flex-wrap items-baseline gap-3">
			<h3 class="text-sm font-semibold">Timetable</h3>
			<span class="ml-auto flex items-center gap-2 text-xs">
				<span class="text-neutral-400">Changes apply from</span>
				<select
					class="rounded border border-neutral-300 px-2 py-1 text-xs"
					bind:value={mode}
					onchange={applyEffective}
				>
					<option value="year">the start of the year</option>
					<option value="date">a date…</option>
				</select>
				{#if mode === 'date'}
					<input
						type="date"
						class="rounded border border-neutral-300 px-2 py-1 text-xs"
						bind:value={fromDate}
						onchange={applyEffective}
					/>
				{/if}
			</span>
		</div>

		{#if form?.error}
			<p role="alert" class="mt-2 text-xs text-neutral-500">{form.error}</p>
		{/if}

		<div class="mt-3 flex flex-wrap gap-6">
			{#each WEEKS as w (w)}
				<table class="border-separate border-spacing-1 text-sm">
					<thead>
						<tr>
							<th class="w-8 pb-1 text-left text-[11px] font-bold tracking-wider text-neutral-500"
								>{w}</th
							>
							{#each DAYS as d (d)}
								<th class="w-14 pb-1 text-xs font-semibold text-neutral-500">{d}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each PERIODS as p (p)}
							<tr>
								<th class="pr-1 text-right text-xs font-medium text-neutral-400">P{p}</th>
								{#each DAYS as d, i (d)}
									{@const day = i + 1}
									{@const slot = slotAt(w, day, p)}
									{@const mine = slot?.classId === data.class.id}
									<td>
										{#if mine}
											<form
												method="POST"
												action="?/toggleSlot"
												use:enhance={() =>
													async ({ update }) =>
														update({ invalidateAll: true })}
											>
												<input type="hidden" name="classId" value={data.class.id} />
												<input type="hidden" name="week" value={w} />
												<input type="hidden" name="day" value={day} />
												<input type="hidden" name="period" value={p} />
												<input type="hidden" name="from" value={effectiveFrom} />
												<button
													type="submit"
													class="h-9 w-14 rounded bg-neutral-900 text-xs font-medium text-white ring-1 ring-neutral-900 ring-inset"
													aria-label="Week {w} {d} P{p} — {data.class.label}, click to clear"
												>
													{data.class.label.split('/')[0]}
												</button>
											</form>
										{:else if slot}
											<button
												type="button"
												disabled
												class="h-9 w-14 cursor-not-allowed rounded bg-[repeating-linear-gradient(45deg,#f5f5f5,#f5f5f5_4px,#e5e5e5_4px,#e5e5e5_8px)] text-[10px] text-neutral-400 ring-1 ring-neutral-200 ring-inset"
												aria-label="Week {w} {d} P{p} — held by another Class"
											>
												·
											</button>
										{:else}
											<form
												method="POST"
												action="?/toggleSlot"
												use:enhance={() =>
													async ({ update }) =>
														update({ invalidateAll: true })}
											>
												<input type="hidden" name="classId" value={data.class.id} />
												<input type="hidden" name="week" value={w} />
												<input type="hidden" name="day" value={day} />
												<input type="hidden" name="period" value={p} />
												<input type="hidden" name="from" value={effectiveFrom} />
												<button
													type="submit"
													class="h-9 w-14 rounded bg-white text-xs text-neutral-300 ring-1 ring-neutral-200 ring-inset hover:bg-neutral-100"
													aria-label="Week {w} {d} P{p} — empty, click to give it to {data.class
														.label}"
												>
													·
												</button>
											</form>
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			{/each}
		</div>
		<p class="mt-2 text-[11px] text-neutral-400">
			Hatched periods belong to another Class — you cannot be in two rooms at once. A double is two
			periods, ticked separately.
		</p>

		{#if data.datedSlots.length}
			<div class="mt-4 rounded-lg bg-white p-3 ring-1 ring-neutral-200">
				<p class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">Dated periods</p>
				<ul class="mt-1 space-y-0.5 text-xs text-neutral-600">
					{#each data.datedSlots as s (s.id)}
						<li class="flex items-baseline gap-2">
							<span class="font-medium">Week {s.week} · {DAYS[s.day - 1]} · P{s.period}</span>
							<span class="text-neutral-400">
								{#if s.holdsFrom}from {fmtLong(s.holdsFrom)}{/if}
								{#if s.holdsTo}{s.holdsFrom ? ', ' : ''}until {fmtLong(s.holdsTo)}{/if}
							</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</section>

	<section class="px-8 pb-8">
		<h3 class="text-sm font-semibold">Assigned Topics</h3>
		<p class="mt-1 text-xs text-neutral-400">
			{data.class.label} teaches these, in this order — decide the next one as you reach it.
		</p>

		{#if form?.error}
			<p role="alert" class="mt-2 text-xs text-neutral-500">{form.error}</p>
		{/if}

		{#if data.assignedTopics.length}
			<ul class="mt-3 grid grid-cols-2 gap-2">
				{#each data.assignedTopics as a, i (a.id)}
					<li
						class="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-neutral-200"
					>
						<span class="w-5 shrink-0 text-right text-xs text-neutral-400">{i + 1}</span>
						<span class="min-w-0 flex-1 truncate">{a.topicName}</span>
						<form
							method="POST"
							action="?/moveAssignedTopic"
							use:enhance={() =>
								async ({ update }) =>
									update({ invalidateAll: true })}
						>
							<input type="hidden" name="classId" value={data.class.id} />
							<input type="hidden" name="id" value={a.id} />
							<input type="hidden" name="direction" value="up" />
							<button
								type="submit"
								disabled={i === 0}
								class="rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100 disabled:opacity-20"
								aria-label="Move {a.topicName} earlier"
							>
								↑
							</button>
						</form>
						<form
							method="POST"
							action="?/moveAssignedTopic"
							use:enhance={() =>
								async ({ update }) =>
									update({ invalidateAll: true })}
						>
							<input type="hidden" name="classId" value={data.class.id} />
							<input type="hidden" name="id" value={a.id} />
							<input type="hidden" name="direction" value="down" />
							<button
								type="submit"
								disabled={i === data.assignedTopics.length - 1}
								class="rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100 disabled:opacity-20"
								aria-label="Move {a.topicName} later"
							>
								↓
							</button>
						</form>
						<form
							method="POST"
							action="?/unassignTopic"
							use:enhance={() =>
								async ({ update }) =>
									update({ invalidateAll: true })}
						>
							<input type="hidden" name="classId" value={data.class.id} />
							<input type="hidden" name="id" value={a.id} />
							<button
								type="submit"
								class="rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
								aria-label="Unassign {a.topicName}"
							>
								✕
							</button>
						</form>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="mt-3 text-xs text-neutral-400">No Topics assigned yet.</p>
		{/if}

		<form
			method="POST"
			action="?/assignTopic"
			class="mt-3 flex items-center gap-2"
			use:enhance={() =>
				async ({ update }) =>
					update({ invalidateAll: true })}
		>
			<input type="hidden" name="classId" value={data.class.id} />
			<select
				name="topicId"
				bind:value={topicToAssign}
				class="rounded border border-neutral-300 px-2 py-1 text-xs"
			>
				{#each data.courseTopics as t (t.id)}
					<option value={t.id}>{t.name}</option>
				{/each}
			</select>
			<button
				type="submit"
				class="rounded bg-neutral-900 px-2 py-1 text-xs text-white disabled:opacity-40"
				disabled={!data.courseTopics.length}
			>
				Assign next
			</button>
			{#if !data.courseTopics.length}
				<span class="text-[11px] text-neutral-400">This Course has no Topics yet.</span>
			{/if}
		</form>
	</section>
</div>
