<script lang="ts">
	// PROTOTYPE — throwaway. Variant C: "Class lanes".
	// Rejects chronology as the organising principle. One lane per Class showing
	// where its Course has got to, what was last taught (with the note), and what
	// is queued next. The week is demoted to a thin strip underneath.
	// Bet: the real question is not "what is next in the day" but "where is each
	// Class up to", and lost Slots matter because of what they do to a Course.
	import {
		TODAY,
		PERIODS,
		DAY_NAMES,
		CLASSES,
		addDays,
		fmtDay,
		fmtLongDay,
		isTeachingDate,
		weekLetterOf,
		weekOf,
		termOf,
		classById,
		toneOf,
		courseProgress,
		sessionAt,
		blockedSlotAt,
		SESSIONS,
		SESSION_NOTES,
		type Session
	} from './fixtures';

	let notes = $state<Record<string, string>>({ ...SESSION_NOTES });
	let weekAnchor = $state(TODAY);
	let expanded = $state<string | null>(null);

	const key = (s: Session) => `${s.classId}|${s.date}|${s.period}`;
	const week = $derived(weekOf(weekAnchor));

	function laneFor(classId: string) {
		const mine = SESSIONS.filter((s) => s.classId === classId);
		const past = mine.filter((s) => s.date < TODAY);
		const upcoming = mine.filter((s) => s.date >= TODAY);
		return {
			last: past[past.length - 1],
			next: upcoming.slice(0, 4),
			progress: courseProgress(classId, TODAY)
		};
	}

	/** Order the lanes by which Class is taught soonest. */
	const lanes = $derived(
		CLASSES.map((c) => ({ cls: c, ...laneFor(c.id) })).sort((a, b) => {
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

<div class="min-h-screen bg-white pb-28 text-neutral-900">
	<header class="border-b border-neutral-200 px-6 py-4">
		<div class="mx-auto flex max-w-7xl items-baseline gap-3">
			<h1 class="text-lg font-semibold tracking-tight">Planner</h1>
			<span class="text-sm text-neutral-500">{fmtLongDay(TODAY)}</span>
			<span class="font-mono text-sm font-bold text-neutral-900">Week {weekLetterOf(TODAY)}</span>
			<span class="text-sm text-neutral-400">{termOf(TODAY)?.name}</span>
		</div>
	</header>

	<div class="mx-auto max-w-7xl px-6 py-6">
		<h2 class="mb-3 text-xs font-bold tracking-wider text-neutral-400 uppercase">
			Where each Class is up to
		</h2>

		<div class="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
			{#each lanes as lane (lane.cls.id)}
				{@const t = toneOf(lane.cls.id)}
				{@const p = lane.progress}
				<article class="flex flex-col rounded-xl border border-neutral-200 bg-white">
					<!-- identity + course position -->
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
						<!-- topic segments: the Course as a bar, current Topic named -->
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

					<!-- last taught, with the note -->
					<div class="px-4 py-3">
						{#if lane.last}
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
						{/if}
					</div>

					<!-- the queue -->
					<div class="mt-auto border-t border-neutral-100 px-4 py-3">
						<div class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
							Next up
						</div>
						<ol class="mt-1.5 space-y-1.5">
							{#each lane.next as s, i (key(s))}
								<li class="flex gap-2 text-sm {i === 0 ? '' : 'opacity-60'}">
									<span
										class="w-24 shrink-0 font-mono text-xs {i === 0 ? t.text : 'text-neutral-400'}"
										>{whenLabel(s)}</span
									>
									<span class="min-w-0 flex-1">
										<span class={i === 0 ? 'font-medium' : ''}>{s.lesson.title}</span>
										{#if s.partsTotal > 1}
											<span class="ml-1 text-[11px] text-neutral-400"
												>{s.part} of {s.partsTotal} Periods</span
											>
										{/if}
										{#if s.continuedFrom}
											<span class="ml-1 text-[11px] font-semibold text-orange-700">↳ continued</span
											>
										{/if}
										{#if s.continues}
											<span class="ml-1 text-[11px] font-semibold text-orange-700"
												>needs more time</span
											>
										{/if}
									</span>
								</li>
							{/each}
						</ol>
						{#if lane.next[0]}
							{@const gap =
								lane.next[1] &&
								Number(
									new Date(lane.next[1].date).getTime() - new Date(lane.next[0].date).getTime()
								) / 86400000}
							{#if gap && gap > 5}
								<p class="mt-2 rounded bg-orange-50 px-2 py-1 text-[11px] text-orange-800">
									{gap} days between the next two — Thu 26 and Fri 27 Nov are Blocked Days.
								</p>
							{/if}
						{/if}
						<button
							class="mt-2 text-xs text-neutral-400 hover:text-neutral-800"
							onclick={() => (expanded = expanded === lane.cls.id ? null : lane.cls.id)}
						>
							{expanded === lane.cls.id ? 'hide' : 'notes and plan'} ↓
						</button>
						{#if expanded === lane.cls.id && lane.next[0]}
							{@const s = lane.next[0]}
							<div class="mt-2 rounded-lg bg-neutral-50 p-3">
								<div class="text-xs font-semibold">{s.lesson.title}</div>
								{#if s.lesson.body}
									<p class="mt-1 text-xs whitespace-pre-line text-neutral-600">
										{s.lesson.body.replace(/\*\*/g, '')}
									</p>
								{:else}
									<p class="mt-1 text-xs text-neutral-400 italic">
										Title only — no plan written yet.
									</p>
								{/if}
								{#if s.lesson.links?.length}
									<ul class="mt-2 space-y-0.5">
										{#each s.lesson.links as link (link.url)}
											<li class="text-xs text-sky-700 underline">{link.label}</li>
										{/each}
									</ul>
								{/if}
								<textarea
									class="mt-2 w-full rounded border border-neutral-300 p-2 text-xs"
									rows="2"
									placeholder="How did it go?"
									bind:value={notes[key(s)]}></textarea>
							</div>
						{/if}
					</div>
				</article>
			{/each}
		</div>

		<!-- the week, demoted to a strip -->
		<div class="mt-8">
			<div class="mb-2 flex items-center gap-3">
				<h2 class="text-xs font-bold tracking-wider text-neutral-400 uppercase">The week</h2>
				<button class="text-neutral-300 hover:text-neutral-700" onclick={() => shiftWeek(-1)}
					>←</button
				>
				<span class="font-mono text-xs font-bold">Week {week.letter}</span>
				<span class="text-xs text-neutral-400">w/c {fmtDay(week.monday)}</span>
				<button class="text-neutral-300 hover:text-neutral-700" onclick={() => shiftWeek(1)}
					>→</button
				>
			</div>
			<div class="space-y-1">
				{#each week.days as d, i (d.date)}
					<div class="flex items-stretch gap-1.5">
						<div
							class="flex w-28 shrink-0 flex-col justify-center rounded px-2 py-1 {d.date === TODAY
								? 'bg-neutral-900 text-white'
								: 'bg-neutral-50 text-neutral-600'}"
						>
							<span class="text-xs font-semibold">{DAY_NAMES[i]}</span>
							<span class="text-[10px] opacity-70">{fmtDay(d.date).slice(4)}</span>
						</div>
						{#if d.blocked}
							<div
								class="flex flex-1 items-center rounded bg-[repeating-linear-gradient(135deg,#f5f5f4_0_6px,#fff_6px_12px)] px-3 text-xs font-medium text-neutral-500"
							>
								Blocked Day — {d.blocked}. Everything after it moved down.
							</div>
						{:else}
							{#each PERIODS as period (period)}
								{@const s = sessionAt(d.date, period)}
								{@const blocked = blockedSlotAt(d.date, period)}
								{#if s}
									{@const st = toneOf(s.classId)}
									<div
										class="min-w-0 flex-1 rounded border-l-2 {st.border} {st.soft} px-2 py-1 {s.date <
										TODAY
											? 'opacity-40'
											: ''}"
									>
										<div class="flex items-baseline gap-1">
											<span class="font-mono text-[9px] text-neutral-400">P{period}</span>
											<span class="text-[11px] font-bold {st.text}"
												>{classById(s.classId).label}</span
											>
										</div>
										<div class="truncate text-[10px] text-neutral-600">{s.lesson.title}</div>
									</div>
								{:else if blocked}
									<div
										class="min-w-0 flex-1 rounded border border-dashed border-orange-300 bg-orange-50 px-2 py-1"
									>
										<div class="flex items-baseline gap-1">
											<span class="font-mono text-[9px] text-orange-400">P{period}</span>
											<span class="text-[11px] font-bold text-orange-900"
												>{classById(blocked.classId).label}</span
											>
										</div>
										<div class="truncate text-[10px] text-orange-700">{blocked.note}</div>
									</div>
								{:else}
									<div class="min-w-0 flex-1 rounded bg-neutral-50/70 px-2 py-1">
										<span class="font-mono text-[9px] text-neutral-300">P{period}</span>
									</div>
								{/if}
							{/each}
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
