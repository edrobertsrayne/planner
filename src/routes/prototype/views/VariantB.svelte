<script lang="ts">
	// PROTOTYPE — throwaway. Variant B: "The week is the app".
	// One screen. The Periods x Days grid is the whole surface; there is no
	// separate agenda — "what am I teaching next" is answered by a narrow Up next
	// rail and by today's column being lit. Clicking a Session opens a drawer
	// where the Lesson body, its links and the Session note all live.
	// Bet: a teacher orients spatially, by the shape of the week, not by a list.
	import {
		TODAY,
		PERIODS,
		DAY_NAMES,
		addDays,
		fmtLongDay,
		fmtDay,
		isTeachingDate,
		weekLetterOf,
		weekOf,
		classById,
		toneOf,
		sessionAt,
		sessionsFrom,
		blockedSlotAt,
		SESSION_NOTES,
		TEACHING_WEEKS,
		type Session
	} from './fixtures';

	let weekAnchor = $state(TODAY);
	let notes = $state<Record<string, string>>({ ...SESSION_NOTES });
	let selected = $state<Session | null>(null);

	const key = (s: Session) => `${s.classId}|${s.date}|${s.period}`;
	const week = $derived(weekOf(weekAnchor));
	const upNext = $derived(sessionsFrom(TODAY, 40).slice(0, 6));

	/** The fortnight ribbon: this week and its partner in the cycle. */
	const ribbon = $derived.by(() => {
		const i = TEACHING_WEEKS.findIndex((w) => w.monday === week.monday);
		return TEACHING_WEEKS.slice(Math.max(0, i - 2), Math.max(0, i - 2) + 6);
	});

	function shiftWeek(delta: number) {
		let d = addDays(weekAnchor, delta * 7);
		for (let i = 0; i < 6 && !weekOf(d).days.some((x) => isTeachingDate(x.date)); i++)
			d = addDays(d, delta * 7);
		weekAnchor = d;
	}
</script>

<div class="flex min-h-screen bg-neutral-100 pb-24 text-neutral-900">
	<!-- Up next rail: the whole of the agenda, compressed into a sidebar -->
	<aside class="hidden w-60 shrink-0 border-r border-neutral-200 bg-white px-4 py-5 lg:block">
		<h2 class="mb-3 text-xs font-bold tracking-wider text-neutral-400 uppercase">Up next</h2>
		<ol class="space-y-2">
			{#each upNext as s, i (key(s))}
				{@const t = toneOf(s.classId)}
				<li>
					<button
						class="w-full rounded-lg border-l-4 {t.border} {i === 0
							? 'bg-neutral-900 text-white'
							: t.soft} px-3 py-2 text-left"
						onclick={() => {
							selected = s;
							weekAnchor = s.date;
						}}
					>
						<div class="flex items-baseline justify-between gap-2">
							<span class="text-xs font-bold {i === 0 ? 'text-white' : t.text}"
								>{classById(s.classId).label}</span
							>
							<span
								class="font-mono text-[10px] {i === 0 ? 'text-neutral-300' : 'text-neutral-500'}"
								>{s.date === TODAY ? 'today' : fmtDay(s.date).slice(0, 6)} P{s.period}</span
							>
						</div>
						<div
							class="mt-0.5 line-clamp-2 text-[11px] leading-tight {i === 0
								? 'text-neutral-200'
								: 'text-neutral-600'}"
						>
							{s.lesson.title}
						</div>
						{#if s.continuedFrom}
							<div class="mt-1 text-[10px] font-semibold text-orange-500">↳ continued</div>
						{/if}
					</button>
				</li>
			{/each}
		</ol>
		<p class="mt-4 text-[11px] leading-snug text-neutral-400">
			Reaches as far as the next six Sessions, whatever that is in days — Thu and Fri are INSET, so
			this runs into next week.
		</p>
	</aside>

	<main class="min-w-0 flex-1 px-6 py-5">
		<!-- The cycle ribbon: where this week sits in the A/B alternation -->
		<div class="mb-4 flex items-center gap-4">
			<h1 class="text-lg font-semibold tracking-tight">Planner</h1>
			<div class="flex items-center gap-1">
				<button
					class="rounded px-2 py-1 text-neutral-400 hover:bg-neutral-200"
					onclick={() => shiftWeek(-1)}>←</button
				>
				{#each ribbon as w (w.monday)}
					<button
						class="rounded px-2.5 py-1 text-xs font-bold {w.monday === week.monday
							? w.letter === 'A'
								? 'bg-neutral-900 text-white'
								: 'bg-white text-neutral-900 ring-2 ring-neutral-900'
							: 'text-neutral-400 hover:bg-neutral-200'}"
						onclick={() => (weekAnchor = w.monday)}
						title="w/c {fmtDay(w.monday)} — {w.term}"
					>
						{w.letter}
					</button>
				{/each}
				<button
					class="rounded px-2 py-1 text-neutral-400 hover:bg-neutral-200"
					onclick={() => shiftWeek(1)}>→</button
				>
			</div>
			<span class="text-sm text-neutral-500">w/c {fmtDay(week.monday)} · {week.term}</span>
			{#if week.monday !== weekOf(TODAY).monday}
				<button class="text-sm text-neutral-500 underline" onclick={() => (weekAnchor = TODAY)}
					>back to today</button
				>
			{/if}
		</div>

		<!-- The grid -->
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
						{d.date.slice(8)}
						{new Date(d.date + 'T00:00:00Z').toLocaleDateString('en-GB', {
							month: 'short',
							timeZone: 'UTC'
						})}{#if d.blocked}<span class="font-semibold"> · {d.blocked}</span>{/if}
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
						<div class="h-24 rounded bg-white/50"></div>
					{/if}
				{/each}
			{/each}
		</div>

		<p class="mt-4 text-xs text-neutral-400">
			Hatched orange = Blocked Day. Dashed = Blocked Slot, with its reason. Dimmed = already taught.
			Click any Session for its plan and notes.
		</p>
	</main>

	<!-- Drawer: everything about one Session, including where notes are written -->
	{#if selected}
		{@const t = toneOf(selected.classId)}
		{@const k = key(selected)}
		<aside class="w-96 shrink-0 overflow-y-auto border-l border-neutral-200 bg-white px-5 py-5">
			<div class="mb-4 flex items-start justify-between">
				<div>
					<span class="rounded px-2 py-0.5 text-sm font-bold {t.bg} {t.text}"
						>{classById(selected.classId).label}</span
					>
					<div class="mt-2 text-xs text-neutral-500">
						{fmtLongDay(selected.date)} · P{selected.period} · Week {weekLetterOf(selected.date)}
					</div>
				</div>
				<button class="text-neutral-400 hover:text-neutral-900" onclick={() => (selected = null)}
					>✕</button
				>
			</div>

			<h2 class="text-lg leading-snug font-semibold">{selected.lesson.title}</h2>
			<div class="mt-1 text-xs text-neutral-500">
				{classById(selected.classId).course} · {selected.lesson.topic}
				{#if selected.partsTotal > 1}· part {selected.part} of {selected.partsTotal}{/if}
			</div>

			{#if selected.continuedFrom}
				<div class="mt-3 rounded bg-orange-50 px-3 py-2 text-xs text-orange-900">
					Continued from the previous Session — this Lesson needed more time.
				</div>
			{/if}

			{#if selected.lesson.body}
				<div
					class="mt-4 border-t border-neutral-100 pt-4 text-sm whitespace-pre-line text-neutral-700"
				>
					{selected.lesson.body.replace(/\*\*/g, '')}
				</div>
			{:else}
				<p class="mt-4 border-t border-neutral-100 pt-4 text-sm text-neutral-400 italic">
					No plan written yet — a title alone is a complete Lesson.
				</p>
			{/if}

			{#if selected.lesson.links?.length}
				<ul class="mt-4 space-y-1">
					{#each selected.lesson.links as link (link.url)}
						<li>
							<span class="text-sm text-sky-700 underline">{link.label}</span>
						</li>
					{/each}
				</ul>
			{/if}

			<div class="mt-6 border-t border-neutral-100 pt-4">
				<div class="mb-1 flex items-baseline justify-between">
					<label for="note" class="text-xs font-bold tracking-wider text-neutral-400 uppercase"
						>How it went</label
					>
					<span class="text-[11px] text-neutral-400">stays with the occasion</span>
				</div>
				<textarea
					id="note"
					class="w-full rounded border border-neutral-300 p-2 text-sm"
					rows="5"
					placeholder="Notes on this Session…"
					bind:value={notes[k]}></textarea>
				<button
					class="mt-3 w-full rounded border px-3 py-2 text-sm font-medium {selected.continues
						? 'border-orange-300 bg-orange-100 text-orange-900'
						: 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'}"
				>
					{selected.continues ? '✓ Needs more time' : 'Needs more time'}
				</button>
				<p class="mt-2 text-[11px] leading-snug text-neutral-400">
					Marking this pushes every later Lesson for {classById(selected.classId).label} down one Available
					Slot.
				</p>
			</div>
		</aside>
	{/if}
</div>
