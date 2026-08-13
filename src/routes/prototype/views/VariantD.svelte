<script lang="ts">
	// PROTOTYPE — throwaway. Variant D: the composite Ed picked out of A, B and C.
	//   - A's shell: separate tabs rather than one crowded screen
	//   - B's grid for the Calendar tab (the better of the two week layouts)
	//   - C promoted from an idea to a third tab, Classes
	//   - one shared Session panel, opened from any of the three
	//   - agenda horizon without "to the end of term"
	//   - Agenda is where you land
	import {
		TODAY,
		BLOCKED_DAYS,
		PERIODS,
		DAY_NAMES,
		CLASSES,
		addDays,
		fmtDay,
		fmtLongDay,
		isTeachingDate,
		weekday,
		weekLetterOf,
		weekOf,
		termOf,
		classById,
		toneOf,
		courseProgress,
		sessionAt,
		sessionsOn,
		blockedSlotAt,
		SESSIONS,
		SESSION_NOTES,
		TEACHING_WEEKS,
		type Session
	} from './fixtures';
	import SessionPanel from './SessionPanel.svelte';

	type Tab = 'agenda' | 'calendar' | 'classes';

	let tab = $state<Tab>('agenda');
	let horizonDays = $state(10);
	let weekAnchor = $state(TODAY);
	let notes = $state<Record<string, string>>({ ...SESSION_NOTES });
	let selected = $state<Session | null>(null);

	const key = (s: Session) => `${s.classId}|${s.date}|${s.period}`;
	const week = $derived(weekOf(weekAnchor));

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

	const ribbon = $derived.by(() => {
		const i = TEACHING_WEEKS.findIndex((w) => w.monday === week.monday);
		const from = Math.max(0, i - 2);
		return TEACHING_WEEKS.slice(from, from + 6);
	});

	const lanes = $derived(
		CLASSES.map((c) => {
			const mine = SESSIONS.filter((s) => s.classId === c.id);
			const past = mine.filter((s) => s.date < TODAY);
			return {
				cls: c,
				last: past[past.length - 1],
				next: mine.filter((s) => s.date >= TODAY).slice(0, 4),
				progress: courseProgress(c.id, TODAY)
			};
		}).sort((a, b) => {
			const ka = a.next[0] ? a.next[0].date + a.next[0].period : 'zz';
			const kb = b.next[0] ? b.next[0].date + b.next[0].period : 'zz';
			return ka.localeCompare(kb);
		})
	);

	function shiftWeek(delta: number) {
		let d = addDays(weekAnchor, delta * 7);
		for (let i = 0; i < 6 && !weekOf(d).days.some((x) => isTeachingDate(x.date)); i++)
			d = addDays(d, delta * 7);
		weekAnchor = d;
	}

	const whenLabel = (s: Session) =>
		s.date === TODAY
			? `today P${s.period}`
			: s.date === addDays(TODAY, 1)
				? `tomorrow P${s.period}`
				: `${fmtDay(s.date)} P${s.period}`;
</script>

<div class="flex min-h-screen bg-neutral-50 text-neutral-900">
	<div class="min-w-0 flex-1 pb-28">
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
				{#each [['agenda', 'Agenda'], ['calendar', 'Calendar'], ['classes', 'Classes']] as [id, label] (id)}
					<button
						class="-mb-px border-b-2 px-4 py-2 text-sm font-medium {tab === id
							? 'border-neutral-900 text-neutral-900'
							: 'border-transparent text-neutral-500 hover:text-neutral-800'}"
						onclick={() => (tab = id as Tab)}>{label}</button
					>
				{/each}
			</nav>
		</header>

		{#if tab === 'agenda'}
			<div class="mx-auto max-w-3xl px-6 py-6">
				<div class="mb-5 flex items-center gap-2 text-sm">
					<span class="text-neutral-500">Show</span>
					{#each [[1, 'Today'], [5, 'Next 5 days'], [10, 'Next 10 days']] as [n, label] (n)}
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
									{#if s}
										{@const t = toneOf(s.classId)}
										{@const past = s.date < TODAY}
										<li>
											<button
												class="flex w-full gap-3 px-4 py-3 text-left hover:bg-neutral-50 {past
													? 'opacity-45'
													: ''} {selected && key(selected) === key(s) ? 'bg-neutral-50' : ''}"
												onclick={() => (selected = s)}
											>
												<span class="w-7 shrink-0 pt-0.5 font-mono text-xs text-neutral-400"
													>P{period}</span
												>
												<span
													class="h-fit shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold {t.bg} {t.text}"
													>{classById(s.classId).label}</span
												>
												<span class="min-w-0 flex-1">
													<span class="flex flex-wrap items-baseline gap-2">
														<span class="font-medium">{s.lesson.title}</span>
														{#if s.continuedFrom}
															<span
																class="rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-semibold text-orange-800"
																>continued</span
															>
														{/if}
														{#if s.partsTotal > 1}
															<span class="text-[11px] text-neutral-500"
																>period {s.part} of {s.partsTotal}</span
															>
														{/if}
													</span>
													<span class="block text-xs text-neutral-500">{s.lesson.topic}</span>
													{#if notes[key(s)]}
														<span
															class="mt-2 block border-l-2 border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-600 italic"
															>{notes[key(s)]}</span
														>
													{/if}
													{#if s.continues}
														<span class="mt-1 block text-xs font-medium text-orange-700">
															Needs more time — this Lesson also takes the next slot.
														</span>
													{/if}
												</span>
												{#if past}<span class="shrink-0 text-neutral-400" title="taught">✓</span
													>{/if}
											</button>
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
									{/if}
								{/each}
							</ul>
						{/if}
					</section>
				{/each}
			</div>
		{:else if tab === 'calendar'}
			<div class="mx-auto max-w-6xl px-6 py-6">
				<div class="mb-4 flex items-center gap-3">
					<button
						class="rounded px-2 py-1 text-neutral-400 hover:bg-neutral-200"
						onclick={() => shiftWeek(-1)}
						aria-label="Previous week">←</button
					>
					{#each ribbon as w (w.monday)}
						<button
							class="rounded px-2.5 py-1 text-xs font-bold {w.monday === week.monday
								? w.letter === 'A'
									? 'bg-neutral-900 text-white'
									: 'bg-white text-neutral-900 ring-2 ring-neutral-900'
								: 'text-neutral-400 hover:bg-neutral-200'}"
							onclick={() => (weekAnchor = w.monday)}
							title="w/c {fmtDay(w.monday)} — {w.term}">{w.letter}</button
						>
					{/each}
					<button
						class="rounded px-2 py-1 text-neutral-400 hover:bg-neutral-200"
						onclick={() => shiftWeek(1)}
						aria-label="Next week">→</button
					>
					<span class="text-sm text-neutral-500">w/c {fmtDay(week.monday)} · {week.term}</span>
					{#if week.monday !== weekOf(TODAY).monday}
						<button class="text-sm text-neutral-500 underline" onclick={() => (weekAnchor = TODAY)}
							>back to today</button
						>
					{/if}
				</div>

				<div class="grid grid-cols-[2.5rem_repeat(5,minmax(0,1fr))] gap-1.5">
					<div></div>
					{#each week.days as d, i (d.date)}
						<div
							class="rounded-t-lg px-2 py-2 {d.date === TODAY
								? 'bg-neutral-900 text-white'
								: d.blocked
									? 'bg-orange-100 text-orange-900'
									: 'bg-white text-neutral-700'}"
						>
							<div class="text-sm font-semibold">{DAY_NAMES[i]}</div>
							<div class="text-xs opacity-70">
								{fmtDay(d.date).slice(4)}{#if d.blocked}<span class="font-semibold"
										>{' · ' + d.blocked}</span
									>{/if}
							</div>
						</div>
					{/each}

					{#each PERIODS as period (period)}
						<div class="flex items-center justify-end pr-1 font-mono text-xs text-neutral-400">
							P{period}
						</div>
						{#each week.days as d (d.date)}
							{@const s = d.blocked ? undefined : sessionAt(d.date, period)}
							{@const blocked = blockedSlotAt(d.date, period)}
							{#if d.blocked}
								<div
									class="flex h-24 items-center justify-center rounded bg-[repeating-linear-gradient(135deg,#fed7aa_0_6px,#ffedd5_6px_12px)] text-[11px] font-semibold text-orange-800/70"
								>
									{period === 3 ? 'Blocked Day' : ''}
								</div>
							{:else if s}
								{@const t = toneOf(s.classId)}
								{@const isSel = selected && key(selected) === key(s)}
								<button
									class="h-24 overflow-hidden rounded border-l-4 {t.border} {t.soft} px-2 py-1.5 text-left transition
										{s.date < TODAY ? 'opacity-40' : ''}
										{isSel ? 'ring-2 ring-neutral-900' : 'hover:brightness-95'}"
									onclick={() => (selected = s)}
								>
									<div class="flex items-center gap-1">
										<span class="text-xs font-bold {t.text}">{classById(s.classId).label}</span>
										{#if notes[key(s)]}<span class="text-[10px] text-neutral-400" title="has a note"
												>✎</span
											>{/if}
									</div>
									<div class="mt-0.5 line-clamp-3 text-[11px] leading-tight text-neutral-700">
										{s.lesson.title}
									</div>
									{#if s.continuedFrom}
										<div class="mt-0.5 text-[10px] font-semibold text-orange-700">↳ continued</div>
									{:else if s.continues}
										<div class="mt-0.5 text-[10px] font-semibold text-orange-700">
											needs more time ↴
										</div>
									{/if}
								</button>
							{:else if blocked}
								<div
									class="h-24 rounded border border-dashed border-orange-400 bg-orange-50 px-2 py-1.5"
								>
									<div class="text-xs font-bold text-orange-900">
										{classById(blocked.classId).label}
									</div>
									<div class="mt-0.5 line-clamp-3 text-[11px] leading-tight text-orange-800">
										{blocked.note}
									</div>
								</div>
							{:else}
								<div class="h-24 rounded bg-white/60"></div>
							{/if}
						{/each}
					{/each}
				</div>

				<p class="mt-4 text-xs text-neutral-400">
					Hatched orange = Blocked Day. Dashed = Blocked Slot, with its reason. Dimmed = already
					taught. ✎ = has a note. Click any Session to open it.
				</p>
			</div>
		{:else}
			<div class="mx-auto max-w-6xl px-6 py-6">
				<h2 class="mb-3 text-xs font-bold tracking-wider text-neutral-400 uppercase">
					Where each Class is up to
				</h2>
				<div class="grid gap-3 lg:grid-cols-2">
					{#each lanes as lane (lane.cls.id)}
						{@const t = toneOf(lane.cls.id)}
						{@const p = lane.progress}
						<article class="flex flex-col rounded-xl border border-neutral-200 bg-white">
							<div class="border-b border-neutral-100 px-4 pt-3 pb-3">
								<div class="flex items-baseline justify-between">
									<span class="rounded px-2 py-0.5 text-sm font-bold {t.bg} {t.text}"
										>{lane.cls.label}</span
									>
									<span class="text-xs text-neutral-400"
										>{p.lessonsDone} of {p.lessonsTotal} Lessons</span
									>
								</div>
								<div class="mt-2 text-xs text-neutral-500">{lane.cls.course}</div>
								<div class="mt-2 flex gap-0.5">
									{#each p.topics as topic (topic.name)}
										{@const done = topic.lessons.filter((l) => l.index < p.lessonsDone).length}
										<div
											class="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200"
											title={topic.name}
										>
											<div
												class="h-full {t.dot}"
												style="width: {Math.round((done / topic.lessons.length) * 100)}%"
											></div>
										</div>
									{/each}
								</div>
								<div class="mt-1.5 text-xs font-medium text-neutral-700">
									{p.currentTopic.name}
									<span class="font-normal text-neutral-400"
										>· Topic {p.currentTopic.index + 1} of {p.topics.length}</span
									>
								</div>
							</div>

							{#if lane.last}
								<button
									class="px-4 py-3 text-left hover:bg-neutral-50"
									onclick={() => (selected = lane.last)}
								>
									<div class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
										Last taught · {fmtDay(lane.last.date)} P{lane.last.period}
									</div>
									<div class="mt-0.5 text-sm text-neutral-600">{lane.last.lesson.title}</div>
									{#if notes[key(lane.last)]}
										<p
											class="mt-1.5 border-l-2 border-neutral-200 pl-2 text-xs text-neutral-500 italic"
										>
											{notes[key(lane.last)]}
										</p>
									{/if}
								</button>
							{/if}

							<div class="mt-auto border-t border-neutral-100 px-4 py-3">
								<div class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
									Next up
								</div>
								<ol class="mt-1.5 space-y-1">
									{#each lane.next as s, i (key(s))}
										<li>
											<button
												class="flex w-full gap-2 rounded px-1 py-0.5 text-left text-sm hover:bg-neutral-50 {i ===
												0
													? ''
													: 'opacity-60'} {selected && key(selected) === key(s)
													? 'bg-neutral-100'
													: ''}"
												onclick={() => (selected = s)}
											>
												<span
													class="w-24 shrink-0 font-mono text-xs {i === 0
														? t.text
														: 'text-neutral-400'}">{whenLabel(s)}</span
												>
												<span class="min-w-0 flex-1">
													<span class={i === 0 ? 'font-medium' : ''}>{s.lesson.title}</span>
													{#if s.partsTotal > 1}
														<span class="ml-1 text-[11px] text-neutral-400"
															>{s.part} of {s.partsTotal} Periods</span
														>
													{/if}
													{#if s.continuedFrom}
														<span class="ml-1 text-[11px] font-semibold text-orange-700"
															>↳ continued</span
														>
													{/if}
													{#if s.continues}
														<span class="ml-1 text-[11px] font-semibold text-orange-700"
															>needs more time</span
														>
													{/if}
												</span>
											</button>
										</li>
									{/each}
								</ol>
								{#if lane.next[0] && lane.next[1]}
									{@const gap =
										(new Date(lane.next[1].date + 'T00:00:00Z').getTime() -
											new Date(lane.next[0].date + 'T00:00:00Z').getTime()) /
										86400000}
									{#if gap > 5}
										<p class="mt-2 rounded bg-orange-50 px-2 py-1 text-[11px] text-orange-800">
											{gap} days between the next two — Blocked Days in between.
										</p>
									{/if}
								{/if}
							</div>
						</article>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	{#if selected}
		<SessionPanel session={selected} bind:notes onclose={() => (selected = null)} />
	{/if}
</div>
