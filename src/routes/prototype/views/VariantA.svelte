<script lang="ts">
	// PROTOTYPE — throwaway. Variant A: "Two surfaces".
	// The agenda is a chronological stream across all Classes with an explicit
	// horizon; the week view is a separate tab holding a Periods x Days grid.
	// Bet: "what am I teaching next" and "what does this week look like" are two
	// different questions and deserve two different screens.
	import {
		TODAY,
		BLOCKED_DAYS,
		BLOCKED_SLOTS,
		PERIODS,
		DAY_NAMES,
		addDays,
		fmtLongDay,
		isTeachingDate,
		weekday,
		weekLetterOf,
		weekOf,
		termOf,
		classById,
		toneOf,
		slotAt,
		sessionAt,
		sessionsOn,
		blockedSlotAt,
		SESSION_NOTES,
		type Session
	} from './fixtures';

	let tab = $state<'agenda' | 'week'>('agenda');
	let horizonDays = $state(10);
	let weekAnchor = $state(TODAY);
	let notes = $state<Record<string, string>>({ ...SESSION_NOTES });
	let openNote = $state<string | null>(null);

	const key = (s: Session) => `${s.classId}|${s.date}|${s.period}`;

	/** Every calendar day in the horizon, teaching or not — Blocked Days must show. */
	const agendaDays = $derived.by(() => {
		const out: { date: string; blocked: string | null; sessions: Session[] }[] = [];
		let d = TODAY;
		let counted = 0;
		while (counted < horizonDays) {
			if (weekday(d) <= 5 && termOf(d)) {
				out.push({ date: d, blocked: BLOCKED_DAYS[d] ?? null, sessions: sessionsOn(d) });
				counted++;
			}
			d = addDays(d, 1);
		}
		return out;
	});

	const week = $derived(weekOf(weekAnchor));

	function shiftWeek(delta: number) {
		let d = addDays(weekAnchor, delta * 7);
		// skip weeks with no teaching at all
		for (let i = 0; i < 6 && !weekOf(d).days.some((x) => isTeachingDate(x.date)); i++)
			d = addDays(d, delta * 7);
		weekAnchor = d;
	}
</script>

<div class="min-h-screen bg-neutral-50 pb-28 text-neutral-900">
	<!-- Chrome: the date, the letter, the term -->
	<header class="border-b border-neutral-200 bg-white">
		<div class="mx-auto flex max-w-6xl items-baseline gap-4 px-6 pt-5">
			<h1 class="text-lg font-semibold tracking-tight">Planner</h1>
			<span class="text-sm text-neutral-500">{fmtLongDay(TODAY)}</span>
			<span
				class="rounded bg-neutral-900 px-2 py-0.5 text-xs font-bold tracking-wider text-white uppercase"
				>Week {weekLetterOf(TODAY)}</span
			>
			<span class="text-sm text-neutral-500">{termOf(TODAY)?.name}</span>
		</div>
		<nav class="mx-auto flex max-w-6xl gap-1 px-6 pt-4">
			{#each [['agenda', 'Agenda'], ['week', 'This week']] as [id, label] (id)}
				<button
					class="-mb-px border-b-2 px-4 py-2 text-sm font-medium {tab === id
						? 'border-neutral-900 text-neutral-900'
						: 'border-transparent text-neutral-500 hover:text-neutral-800'}"
					onclick={() => (tab = id as 'agenda' | 'week')}>{label}</button
				>
			{/each}
		</nav>
	</header>

	{#if tab === 'agenda'}
		<div class="mx-auto max-w-3xl px-6 py-6">
			<div class="mb-5 flex items-center gap-2 text-sm">
				<span class="text-neutral-500">Show</span>
				{#each [[1, 'Today'], [5, 'Next 5 days'], [10, 'Next 10 days'], [25, 'To the end of term']] as [n, label] (n)}
					<button
						class="rounded-full px-3 py-1 {horizonDays === n
							? 'bg-neutral-900 text-white'
							: 'bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-100'}"
						onclick={() => (horizonDays = n as number)}>{label}</button
					>
				{/each}
			</div>

			{#each agendaDays as day (day.date)}
				{@const isToday = day.date === TODAY}
				<section class="mb-6">
					<div class="mb-2 flex items-baseline gap-3">
						<h2 class="text-sm font-semibold {isToday ? 'text-neutral-900' : 'text-neutral-600'}">
							{isToday ? 'Today — ' : ''}{fmtLongDay(day.date)}
						</h2>
						<span class="font-mono text-xs text-neutral-400">Week {weekLetterOf(day.date)}</span>
					</div>

					{#if day.blocked}
						<div
							class="rounded-lg border border-dashed border-neutral-300 bg-[repeating-linear-gradient(135deg,#f5f5f5_0_8px,#fff_8px_16px)] px-4 py-3 text-sm text-neutral-500"
						>
							<span class="font-medium text-neutral-700">Blocked Day — {day.blocked}.</span>
							Nothing is taught; everything after it has moved down.
						</div>
					{:else}
						<ul
							class="divide-y divide-neutral-100 overflow-hidden rounded-lg bg-white ring-1 ring-neutral-200"
						>
							{#each PERIODS as period (period)}
								{@const s = day.sessions.find((x) => x.period === period)}
								{@const blocked = blockedSlotAt(day.date, period)}
								{@const slot = slotAt(weekLetterOf(day.date) ?? 'A', weekday(day.date), period)}
								{#if s}
									{@const t = toneOf(s.classId)}
									{@const k = key(s)}
									{@const past = s.date < TODAY}
									<li class="flex gap-3 px-4 py-3 {past ? 'opacity-45' : ''}">
										<span class="w-7 shrink-0 pt-0.5 font-mono text-xs text-neutral-400"
											>P{period}</span
										>
										<span
											class="h-fit shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold {t.bg} {t.text}"
											>{classById(s.classId).label}</span
										>
										<div class="min-w-0 flex-1">
											<div class="flex flex-wrap items-baseline gap-2">
												<span class="font-medium">{s.lesson.title}</span>
												{#if s.continuedFrom}
													<span
														class="rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-semibold text-orange-800"
														>continued</span
													>
												{/if}
												{#if s.partsTotal > 1}
													<span class="text-[11px] text-neutral-500"
														>part {s.part} of {s.partsTotal}</span
													>
												{/if}
											</div>
											<div class="text-xs text-neutral-500">{s.lesson.topic}</div>
											{#if notes[k] || openNote === k}
												<div class="mt-2">
													{#if openNote === k}
														<!-- svelte-ignore a11y_autofocus -->
														<textarea
															autofocus
															class="w-full rounded border border-neutral-300 p-2 text-sm"
															rows="3"
															bind:value={notes[k]}
															onblur={() => (openNote = null)}></textarea>
													{:else}
														<button
															class="w-full rounded border-l-2 border-neutral-300 bg-neutral-50 px-3 py-2 text-left text-sm text-neutral-600 italic hover:bg-neutral-100"
															onclick={() => (openNote = k)}>{notes[k]}</button
														>
													{/if}
												</div>
											{:else if !past}
												<button
													class="mt-1 text-xs text-neutral-400 hover:text-neutral-700"
													onclick={() => (openNote = k)}>+ note</button
												>
											{/if}
											{#if s.continues}
												<div class="mt-1 text-xs font-medium text-orange-700">
													Needs more time — this Lesson also takes the next slot.
												</div>
											{/if}
										</div>
										{#if past}
											<span class="shrink-0 text-neutral-400" title="taught">✓</span>
										{/if}
									</li>
								{:else if blocked}
									<li class="flex gap-3 bg-neutral-50 px-4 py-3 text-sm">
										<span class="w-7 shrink-0 font-mono text-xs text-neutral-400">P{period}</span>
										<span
											class="shrink-0 rounded bg-neutral-200 px-1.5 py-0.5 text-xs font-semibold text-neutral-600"
											>{classById(blocked.classId).label}</span
										>
										<span class="text-neutral-500 line-through decoration-neutral-300"
											>Blocked Slot</span
										>
										<span class="text-neutral-500">— {blocked.note}</span>
									</li>
								{:else if slot}
									<li class="px-4 py-2 text-xs text-neutral-300">P{period} — free</li>
								{/if}
							{/each}
						</ul>
					{/if}
				</section>
			{/each}
		</div>
	{:else}
		<!-- Week view: the timetable grid -->
		<div class="mx-auto max-w-6xl px-6 py-6">
			<div class="mb-4 flex items-center gap-3">
				<button
					class="rounded border border-neutral-300 bg-white px-2 py-1 text-sm hover:bg-neutral-100"
					onclick={() => shiftWeek(-1)}>←</button
				>
				<div class="flex items-baseline gap-3">
					<span class="text-sm font-semibold">w/c {fmtLongDay(week.monday)}</span>
					<span
						class="rounded px-2 py-0.5 text-xs font-bold tracking-wider uppercase {week.letter ===
						'A'
							? 'bg-neutral-900 text-white'
							: 'bg-white text-neutral-900 ring-1 ring-neutral-900'}">Week {week.letter}</span
					>
					<span class="text-sm text-neutral-500">{week.term}</span>
				</div>
				<button
					class="rounded border border-neutral-300 bg-white px-2 py-1 text-sm hover:bg-neutral-100"
					onclick={() => shiftWeek(1)}>→</button
				>
				<button
					class="ml-2 text-sm text-neutral-500 hover:text-neutral-900"
					onclick={() => (weekAnchor = TODAY)}>Today</button
				>
			</div>

			<div class="overflow-x-auto">
				<table class="w-full min-w-[760px] table-fixed border-separate border-spacing-1 text-sm">
					<thead>
						<tr>
							<th class="w-9"></th>
							{#each week.days as d, i (d.date)}
								<th
									class="rounded px-2 py-1.5 text-left text-xs font-semibold {d.date === TODAY
										? 'bg-neutral-900 text-white'
										: 'bg-white text-neutral-600'}"
								>
									{DAY_NAMES[i]}
									<span class="font-normal opacity-70">{d.date.slice(8)}/{d.date.slice(5, 7)}</span>
									{#if d.blocked}<span class="ml-1 font-normal text-orange-500">{d.blocked}</span
										>{/if}
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each PERIODS as period (period)}
							<tr>
								<td class="pr-1 text-right align-top font-mono text-xs text-neutral-400"
									>P{period}</td
								>
								{#each week.days as d (d.date)}
									{@const s = d.blocked ? undefined : sessionAt(d.date, period)}
									{@const blocked = blockedSlotAt(d.date, period)}
									<td class="align-top">
										{#if d.blocked}
											<div
												class="h-[68px] rounded bg-[repeating-linear-gradient(135deg,#fafafa_0_6px,#fff_6px_12px)] ring-1 ring-neutral-200"
											></div>
										{:else if s}
											{@const t = toneOf(s.classId)}
											<div
												class="h-[68px] overflow-hidden rounded border-l-4 {t.border} {t.soft} px-2 py-1.5 {s.date <
												TODAY
													? 'opacity-45'
													: ''}"
											>
												<div class="flex items-center gap-1">
													<span class="text-xs font-bold {t.text}"
														>{classById(s.classId).label}</span
													>
													{#if s.continuedFrom}<span class="text-[10px] text-orange-700"
															>↳ cont.</span
														>{/if}
													{#if notes[key(s)]}<span class="text-[10px] text-neutral-400">✎</span
														>{/if}
												</div>
												<div class="line-clamp-2 text-[11px] leading-tight text-neutral-700">
													{s.lesson.title}
												</div>
											</div>
										{:else if blocked}
											<div
												class="h-[68px] rounded border border-dashed border-orange-300 bg-orange-50 px-2 py-1.5"
											>
												<div class="text-xs font-bold text-orange-900">
													{classById(blocked.classId).label}
												</div>
												<div class="line-clamp-2 text-[11px] leading-tight text-orange-700">
													{blocked.note}
												</div>
											</div>
										{:else}
											<div class="h-[68px] rounded bg-white ring-1 ring-neutral-100"></div>
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<p class="mt-4 text-xs text-neutral-400">
				Blocked Days are hatched. Blocked Slots keep their free text. Sessions already taught are
				dimmed; notes show as ✎ and are read and written on the agenda.
			</p>
			{#if BLOCKED_SLOTS.length}
				<p class="mt-1 text-xs text-neutral-400">
					Week grid is read-only here — everything editable lives on the agenda.
				</p>
			{/if}
		</div>
	{/if}
</div>
