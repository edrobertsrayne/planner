<script lang="ts">
	// PROTOTYPE — throwaway. Variant B: the Class is the page.
	//
	// The bet: there is no shared timetable canvas, because there is no shared
	// object — a Class is a label, a Course and a timetable, and those three
	// things want to be in one place. Setup is a rhythm you repeat six times:
	// create the Class, tick its periods, give it its first Topic. Everything a
	// Class has is on one screen, so the in-year jobs (assign the next Topic,
	// end a Slot) are where you already are rather than on a separate surface.
	//
	// The cost this is testing: the fortnight is entered six times over instead
	// of once, and the school's timetable sheet has to be read six times too.
	import {
		CLASSES,
		COURSES,
		DAYS,
		PERIODS,
		TODAY,
		TONE,
		WEEKS,
		YEAR_START,
		addClass,
		allSlotsOf,
		alsoAssigned,
		assignTopic,
		classById,
		clearSlot,
		courseById,
		endSlot,
		fmtLong,
		moveAssigned,
		removeClass,
		runway,
		slotAt,
		slotsOf,
		takeSlot,
		topicById,
		topicsOf,
		unassignTopic
	} from './fixtures.svelte';
	import Lane from './Lane.svelte';

	let selected = $state('9B');
	const cls = $derived(classById(selected));

	let effective = $state<'year' | 'date'>('year');
	let from = $state('2027-01-05');
	const on = $derived(effective === 'year' ? YEAR_START : from);

	let adding = $state(false);
	let newLabel = $state('');
	let newCourse = $state(COURSES[0].id);

	function commitClass() {
		const label = newLabel.trim();
		if (!label) return;
		selected = addClass(label, newCourse).id;
		newLabel = '';
		adding = false;
	}

	function toggle(week: (typeof WEEKS)[number], day: number, period: number) {
		const held = slotAt(week, day, period, on);
		if (held && held.classId === selected) clearSlot(week, day, period, on);
		else if (!held) takeSlot(week, day, period, selected, on);
		// a period held by *another* Class does nothing on click — the point of
		// showing it at all is that you can see why you cannot have it
	}

	const dayName = (d: number) => DAYS[d];
</script>

<div class="flex min-h-screen flex-col bg-neutral-50 text-neutral-900">
	<header class="shrink-0 border-b border-neutral-200 bg-white">
		<div class="flex items-baseline gap-4 px-6 pt-5">
			<h1 class="text-lg font-semibold tracking-tight">Planner</h1>
			<span class="text-sm text-neutral-500">Tuesday, 24 November 2026</span>
			<span
				class="rounded bg-neutral-900 px-2 py-0.5 text-xs font-bold tracking-wider text-white uppercase"
				>Week B</span
			>
		</div>
		<nav class="flex gap-1 px-6 pt-4">
			{#each ['Agenda', 'Calendar', 'Classes', 'Courses'] as label (label)}
				<button
					class="-mb-px border-b-2 px-4 py-2 text-sm font-medium {label === 'Classes'
						? 'border-neutral-900 text-neutral-900'
						: 'border-transparent text-neutral-400'}"
					disabled={label !== 'Classes'}>{label}</button
				>
			{/each}
		</nav>
	</header>

	<div class="flex min-h-0 flex-1">
		<aside class="w-64 shrink-0 border-r border-neutral-200 bg-white py-3">
			<h2 class="px-4 pb-2 text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
				Classes
			</h2>
			{#each CLASSES as c (c.id)}
				{@const r = runway(c.id)}
				<button
					class="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-neutral-50 {c.id ===
					selected
						? 'bg-neutral-100'
						: ''}"
					onclick={() => (selected = c.id)}
				>
					<span class="h-3 w-3 shrink-0 rounded-sm {TONE[c.tone].dot}"></span>
					<span class="min-w-0 flex-1">
						<span class="block text-sm font-medium">{c.label}</span>
						<span class="block truncate text-xs text-neutral-400"
							>{r.left} Lessons left · {slotsOf(c.id, TODAY).length} periods</span
						>
					</span>
				</button>
			{/each}
			<div class="px-4 pt-3">
				{#if adding}
					<div class="space-y-1.5 rounded border border-neutral-300 p-2">
						<!-- svelte-ignore a11y_autofocus -->
						<input
							autofocus
							class="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
							placeholder="9B/Sc1"
							bind:value={newLabel}
							onkeydown={(e) => e.key === 'Enter' && commitClass()}
						/>
						<select
							class="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
							bind:value={newCourse}
						>
							{#each COURSES as c (c.id)}
								<option value={c.id}>{c.name}</option>
							{/each}
						</select>
						<button
							class="w-full rounded bg-neutral-900 px-2 py-1 text-xs text-white"
							onclick={commitClass}>Create Class</button
						>
					</div>
				{:else}
					<button
						class="text-sm text-neutral-500 hover:text-neutral-900"
						onclick={() => (adding = true)}>+ New Class</button
					>
				{/if}
			</div>
		</aside>

		<main class="min-w-0 flex-1 overflow-y-auto pb-28">
			<!-- identity -->
			<div class="border-b border-neutral-200 bg-white px-8 py-5">
				<div class="flex items-baseline gap-3">
					<h2 class="text-xl font-semibold tracking-tight">{cls.label}</h2>
					<span class="rounded px-2 py-0.5 text-xs ring-1 {TONE[cls.tone].chip}"
						>{courseById(cls.courseId).name}</span
					>
					<button
						class="ml-auto text-xs text-neutral-300 hover:text-red-600"
						onclick={() => {
							removeClass(cls.id);
							selected = CLASSES[0]?.id;
						}}>Delete Class</button
					>
				</div>
				<p class="mt-1 text-xs text-neutral-400">
					The Course is fixed at creation and cannot be changed — a mis-pick means deleting the
					Class and starting again.
				</p>
			</div>

			<div class="grid grid-cols-[22rem_minmax(0,1fr)] gap-6 px-8 py-6">
				<!-- the lane card from #6, unchanged: this page is that card, opened -->
				<div><Lane classId={cls.id} /></div>

				<!-- the timetable, this Class's own -->
				<section>
					<div class="flex items-baseline gap-3">
						<h3 class="text-sm font-semibold">Timetable</h3>
						<span class="text-xs text-neutral-400"
							>{slotsOf(cls.id, on).length} periods a fortnight</span
						>
						<span class="ml-auto flex items-center gap-2 text-xs">
							<span class="text-neutral-400">Changes apply from</span>
							<select
								class="rounded border border-neutral-300 px-2 py-1 text-xs"
								bind:value={effective}
							>
								<option value="year">the start of the year</option>
								<option value="date">a date…</option>
							</select>
							{#if effective === 'date'}
								<input
									type="date"
									class="rounded border border-neutral-300 px-2 py-1 text-xs"
									bind:value={from}
								/>
							{/if}
						</span>
					</div>

					<div class="mt-3 flex flex-wrap gap-6">
						{#each WEEKS as w (w)}
							<table class="border-separate border-spacing-1 text-sm">
								<thead>
									<tr>
										<th
											class="w-8 pb-1 text-left text-[11px] font-bold tracking-wider text-neutral-500"
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
												{@const s = slotAt(w, i, p, on)}
												{@const mine = s?.classId === cls.id}
												<td>
													<button
														class="h-9 w-14 rounded text-xs ring-1 ring-inset {mine
															? TONE[cls.tone].cell
															: s
																? 'cursor-not-allowed bg-[repeating-linear-gradient(45deg,#f5f5f5,#f5f5f5_4px,#e5e5e5_4px,#e5e5e5_8px)] text-neutral-400 ring-neutral-200'
																: 'bg-white text-neutral-300 ring-neutral-200 hover:bg-neutral-100'}"
														aria-label="Week {w} {d} P{p}"
														onclick={() => toggle(w, i, p)}
													>
														{#if mine}
															<span class="font-medium">{cls.label.split('/')[0]}</span>
														{:else if s}
															<span class="text-[10px]"
																>{classById(s.classId).label.split('/')[0]}</span
															>
														{:else}
															·
														{/if}
													</button>
												</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						{/each}
					</div>
					<p class="mt-2 text-[11px] text-neutral-400">
						Hatched periods belong to another Class — you cannot be in two rooms at once. A double
						is two periods, ticked separately.
					</p>

					<!-- the date ranges, which the grid alone cannot show -->
					{#if allSlotsOf(cls.id).some((s) => s.to || s.from !== YEAR_START)}
						<div class="mt-4 rounded-lg bg-white p-3 ring-1 ring-neutral-200">
							<p class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
								Dated periods
							</p>
							<ul class="mt-1 space-y-0.5 text-xs text-neutral-600">
								{#each allSlotsOf(cls.id).filter((s) => s.to || s.from !== YEAR_START) as s (s.id)}
									<li class="flex items-baseline gap-2">
										<span class="font-medium">Week {s.week} · {dayName(s.day)} · P{s.period}</span>
										<span class="text-neutral-400">
											{#if s.from !== YEAR_START}from {fmtLong(s.from)}{/if}
											{#if s.to}{s.from !== YEAR_START ? ', ' : ''}until {fmtLong(s.to)}{/if}
										</span>
										{#if !s.to}
											<button
												class="ml-auto text-neutral-300 hover:text-red-600"
												onclick={() => endSlot(s, TODAY)}>end it today</button
											>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</section>
			</div>

			<!-- Assigned Topics, as a shelf: the Course on the left, this Class's order on the right -->
			<section class="border-t border-neutral-200 px-8 py-6">
				<h3 class="text-sm font-semibold">Topics</h3>
				<div class="mt-3 grid grid-cols-2 gap-6">
					<div class="rounded-lg bg-white ring-1 ring-neutral-200">
						<p
							class="border-b border-neutral-100 px-3 py-2 text-[11px] tracking-wider text-neutral-400 uppercase"
						>
							{courseById(cls.courseId).name}
						</p>
						<ul class="max-h-72 overflow-y-auto">
							{#each topicsOf(cls.courseId) as t (t.id)}
								{@const mine = cls.assigned.includes(t.id)}
								{@const others = alsoAssigned(t.id, cls.id)}
								<li>
									<button
										class="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50"
										onclick={() => assignTopic(cls.id, t.id)}
									>
										<span class="min-w-0 flex-1 truncate {mine ? 'text-neutral-400' : ''}"
											>{t.name}</span
										>
										{#if mine}
											<span class="shrink-0 text-[11px] text-neutral-400">assigned</span>
										{:else if others.length}
											<span class="shrink-0 text-[11px] text-neutral-400"
												>{others.map((o) => o.label).join(', ')}</span
											>
										{/if}
										<span class="shrink-0 font-mono text-xs text-neutral-300"
											>{t.lessons.length || '—'}</span
										>
										<span class="shrink-0 text-neutral-300">→</span>
									</button>
								</li>
							{/each}
						</ul>
					</div>

					<div class="rounded-lg bg-white ring-1 ring-neutral-200">
						<p
							class="border-b border-neutral-100 px-3 py-2 text-[11px] tracking-wider text-neutral-400 uppercase"
						>
							Taught by {cls.label}, in order
						</p>
						<ol class="max-h-72 overflow-y-auto">
							{#each cls.assigned as tid, i (tid + i)}
								{@const t = topicById(tid)}
								<li class="group flex items-baseline gap-2 px-3 py-2 text-sm hover:bg-neutral-50">
									<span class="font-mono text-xs text-neutral-300">{i + 1}</span>
									<span class="min-w-0 flex-1 truncate">{t.name}</span>
									<span class="shrink-0 font-mono text-xs text-neutral-400">{t.lessons.length}</span
									>
									<span class="shrink-0 opacity-0 group-hover:opacity-100">
										<button
											class="px-1 text-neutral-400 hover:text-neutral-900"
											onclick={() => moveAssigned(cls.id, i, i - 1)}
											aria-label="Move up">↑</button
										>
										<button
											class="px-1 text-neutral-400 hover:text-neutral-900"
											onclick={() => moveAssigned(cls.id, i, i + 1)}
											aria-label="Move down">↓</button
										>
										<button
											class="px-1 text-neutral-400 hover:text-red-600"
											onclick={() => unassignTopic(cls.id, i)}
											aria-label="Unassign">✕</button
										>
									</span>
								</li>
							{/each}
							{#if !cls.assigned.length}
								<li class="px-3 py-3 text-sm text-neutral-400">
									Nothing yet — give it the Topic you are starting with.
								</li>
							{/if}
						</ol>
						<p class="border-t border-neutral-100 px-3 py-2 text-[11px] text-neutral-400">
							{runway(cls.id).left} Lessons left to teach. Assigning re-runs the schedule forward from
							today.
						</p>
					</div>
				</div>
			</section>
		</main>
	</div>
</div>
