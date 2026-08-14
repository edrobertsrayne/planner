<script lang="ts">
	// PROTOTYPE — throwaway. Variant A: the fortnight is a canvas you paint.
	//
	// The bet: entering a timetable is transcribing one document — the sheet the
	// school hands you in September — so the screen should be that document. One
	// grid, all Classes at once, Week A beside Week B. Classes are the palette
	// down the left; you pick one and paint its periods, which is far fewer
	// decisions than "open Class, tick cells, go back, open next Class".
	//
	// Assigning a Topic is somewhere else entirely (the Classes sub-view), because
	// it is an in-year job and the timetable is a September job.
	import {
		CLASSES,
		COURSES,
		DAYS,
		PERIODS,
		SLOTS,
		TODAY,
		TONE,
		WEEKS,
		YEAR_START,
		addClass,
		alsoAssigned,
		assignTopic,
		classById,
		clearSlot,
		courseById,
		fmtLong,
		historyAt,
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

	type SubView = 'classes' | 'timetable';
	const SUBVIEWS: [SubView, string][] = [
		['classes', 'Classes'],
		['timetable', 'Timetable']
	];

	let view = $state<SubView>('timetable');

	// the timetable canvas
	let painting = $state<string | null>('9B');
	let mode = $state<'setup' | 'change'>('setup');
	let changeFrom = $state('2027-01-05');
	const on = $derived(mode === 'setup' ? YEAR_START : changeFrom);

	// new Class, created at the foot of the palette — #22's idiom
	let adding = $state(false);
	let newLabel = $state('');
	let newCourse = $state(COURSES[0].id);

	// assigning, on the Classes sub-view
	let picking = $state<string | null>(null);

	function commitClass() {
		const label = newLabel.trim();
		if (!label) return;
		painting = addClass(label, newCourse).id;
		newLabel = '';
		adding = false;
	}

	function cell(week: (typeof WEEKS)[number], day: number, period: number) {
		const held = slotAt(week, day, period, on);
		if (held && painting && held.classId === painting) clearSlot(week, day, period, on);
		else if (painting) takeSlot(week, day, period, painting, on);
	}

	// as it stands today — a Slot that has already ended does not count
	const periodsAFortnight = (id: string) => slotsOf(id, TODAY).length;
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

	<!-- the Classes tab holds two surfaces: the everyday one and the September one -->
	<div class="flex items-center gap-3 border-b border-neutral-200 bg-white px-6 py-2">
		{#each SUBVIEWS as [key, label] (key)}
			<button
				class="rounded-full px-3 py-1 text-sm {view === key
					? 'bg-neutral-900 text-white'
					: 'text-neutral-500 hover:bg-neutral-100'}"
				onclick={() => (view = key)}>{label}</button
			>
		{/each}
		{#if view === 'timetable'}
			<span class="ml-auto flex items-center gap-2 text-sm">
				<span class="text-neutral-400">Showing</span>
				<select class="rounded border border-neutral-300 px-2 py-1 text-sm" bind:value={mode}>
					<option value="setup">the timetable as set up in September</option>
					<option value="change">a change from…</option>
				</select>
				{#if mode === 'change'}
					<input
						type="date"
						class="rounded border border-neutral-300 px-2 py-1 text-sm"
						bind:value={changeFrom}
					/>
				{/if}
			</span>
		{/if}
	</div>

	{#if view === 'timetable'}
		<div class="flex min-h-0 flex-1">
			<!-- the palette: Classes are paint -->
			<aside class="w-60 shrink-0 border-r border-neutral-200 bg-white py-3">
				<h2 class="px-4 pb-2 text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
					Classes
				</h2>
				{#each CLASSES as c (c.id)}
					<button
						class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-neutral-50 {c.id ===
						painting
							? 'bg-neutral-100'
							: ''}"
						onclick={() => (painting = c.id)}
					>
						<span class="h-3 w-3 shrink-0 rounded-sm {TONE[c.tone].dot}"></span>
						<span class="min-w-0 flex-1">
							<span class="block font-medium {c.id === painting ? '' : 'font-normal'}"
								>{c.label}</span
							>
							<span class="block truncate text-xs text-neutral-400"
								>{courseById(c.courseId).name}</span
							>
						</span>
						<span class="shrink-0 font-mono text-xs text-neutral-400"
							>{periodsAFortnight(c.id)}</span
						>
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
							<p class="text-[11px] leading-snug text-neutral-400">
								The Course is fixed once the Class exists.
							</p>
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
				{#if painting}
					<p class="px-4 pt-4 text-[11px] leading-snug text-neutral-400">
						Click a period to give it to <span class="font-medium text-neutral-600"
							>{classById(painting).label}</span
						>. Click it again to clear it. A double is simply two periods.
					</p>
				{/if}
			</aside>

			<main class="min-w-0 flex-1 overflow-auto p-6 pb-28">
				{#if mode === 'change'}
					<p
						class="mb-4 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200"
					>
						Editing the timetable <strong>from {fmtLong(changeFrom)}</strong>. Whatever a period
						held before that date keeps it up to then — nothing already taught moves.
					</p>
				{/if}

				<table class="w-full table-fixed border-separate border-spacing-1 text-sm">
					<thead>
						<tr>
							<th class="w-9"></th>
							{#each WEEKS as w (w)}
								<th colspan="5" class="pb-1 text-left">
									<span class="rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] text-white"
										>Week {w}</span
									>
								</th>
							{/each}
						</tr>
						<tr>
							<th class="w-9"></th>
							{#each WEEKS as w (w)}
								{#each DAYS as d, i (d)}
									<th
										class="pb-1 text-xs font-semibold text-neutral-500 {i === 0 && w === 'B'
											? 'border-l-2 border-neutral-300'
											: ''}">{d}</th
									>
								{/each}
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each PERIODS as p (p)}
							<tr>
								<th class="pr-1 text-right align-middle text-xs font-medium text-neutral-400"
									>P{p}</th
								>
								{#each WEEKS as w (w)}
									{#each DAYS as d, i (d)}
										{@const s = slotAt(w, i, p, on)}
										{@const past = historyAt(w, i, p).filter((x) => x !== s)}
										<td class="h-12 {i === 0 && w === 'B' ? 'border-l-2 border-neutral-300' : ''}">
											<button
												aria-label="Week {w} {d} P{p}"
												class="flex h-12 w-full flex-col items-center justify-center overflow-hidden rounded text-xs leading-tight ring-1 ring-inset {s
													? TONE[classById(s.classId).tone].cell
													: 'bg-white text-neutral-300 ring-neutral-200 hover:bg-neutral-100'}"
												onclick={() => cell(w, i, p)}
											>
												{#if s}
													<span class="block font-medium">{classById(s.classId).label}</span>
													{#if s.to}
														<span class="block text-[10px] opacity-70"
															>to {s.to.slice(8)}/{s.to.slice(5, 7)}</span
														>
													{:else if past.length}
														<span class="block text-[10px] opacity-70">changed</span>
													{/if}
												{:else}
													·
												{/if}
											</button>
										</td>
									{/each}
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>

				<p class="mt-4 text-xs text-neutral-400">
					{SLOTS.filter((s) => s.from <= TODAY && (!s.to || s.to >= TODAY)).length} periods a fortnight
					across {CLASSES.length} Classes. 13A/Ph1 stops on 14 May — study leave is just a Slot that ends.
				</p>
			</main>
		</div>
	{:else}
		<!-- the everyday surface: one card per Class, and the permanent Assign control -->
		<main class="grid flex-1 grid-cols-[repeat(auto-fill,minmax(22rem,1fr))] gap-4 p-6 pb-28">
			{#each CLASSES as c (c.id)}
				{@const r = runway(c.id)}
				<section class="flex flex-col rounded-xl bg-white p-5 ring-1 ring-neutral-200">
					<div class="flex items-baseline gap-2">
						<span class="h-3 w-3 shrink-0 rounded-sm {TONE[c.tone].dot}"></span>
						<h2 class="text-base font-semibold">{c.label}</h2>
						<span class="text-xs text-neutral-400">{courseById(c.courseId).name}</span>
						<button
							class="ml-auto text-xs text-neutral-300 hover:text-red-600"
							onclick={() => removeClass(c.id)}>delete</button
						>
					</div>
					<p class="mt-1 text-xs text-neutral-400">
						{slotsOf(c.id, TODAY).length} periods a fortnight · {r.taught} of {r.total} Lessons taught
					</p>

					<ol class="mt-3 space-y-1">
						{#each c.assigned as tid, i (tid + i)}
							{@const t = topicById(tid)}
							<li
								class="group flex items-baseline gap-2 rounded px-2 py-1 text-sm hover:bg-neutral-50"
							>
								<span class="font-mono text-xs text-neutral-300">{i + 1}</span>
								<span class="min-w-0 flex-1 truncate">{t.name}</span>
								<span class="shrink-0 font-mono text-xs text-neutral-400">{t.lessons.length}</span>
								<span class="shrink-0 opacity-0 group-hover:opacity-100">
									<button
										class="px-1 text-neutral-400 hover:text-neutral-900"
										onclick={() => moveAssigned(c.id, i, i - 1)}
										aria-label="Move up">↑</button
									>
									<button
										class="px-1 text-neutral-400 hover:text-neutral-900"
										onclick={() => moveAssigned(c.id, i, i + 1)}
										aria-label="Move down">↓</button
									>
									<button
										class="px-1 text-neutral-400 hover:text-red-600"
										onclick={() => unassignTopic(c.id, i)}
										aria-label="Unassign">✕</button
									>
								</span>
							</li>
						{/each}
						{#if !c.assigned.length}
							<li class="px-2 py-1 text-sm text-neutral-400">Nothing assigned yet.</li>
						{/if}
					</ol>

					<!-- the permanent control: it lives on the card, not in setup -->
					{#if picking === c.id}
						<div class="mt-3 rounded-lg border border-neutral-200">
							<p class="border-b border-neutral-100 px-3 py-1.5 text-[11px] text-neutral-400">
								Topics in {courseById(c.courseId).name}
							</p>
							<ul class="max-h-56 overflow-y-auto">
								{#each topicsOf(c.courseId) as t (t.id)}
									{@const mine = c.assigned.includes(t.id)}
									{@const others = alsoAssigned(t.id, c.id)}
									<li>
										<button
											class="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm hover:bg-neutral-50"
											onclick={() => {
												assignTopic(c.id, t.id);
												picking = null;
											}}
										>
											<span class="min-w-0 flex-1 truncate {mine ? 'text-neutral-400' : ''}"
												>{t.name}</span
											>
											{#if mine}
												<span class="shrink-0 text-[11px] text-neutral-400">already here</span>
											{:else if others.length}
												<span class="shrink-0 text-[11px] text-neutral-400"
													>with {others.map((o) => o.label).join(', ')}</span
												>
											{/if}
											<span class="shrink-0 font-mono text-xs text-neutral-300"
												>{t.lessons.length || '—'}</span
											>
										</button>
									</li>
								{/each}
							</ul>
						</div>
					{:else}
						<button
							class="mt-3 self-start text-sm text-neutral-500 hover:text-neutral-900"
							onclick={() => (picking = c.id)}>+ Assign Topic</button
						>
					{/if}
				</section>
			{/each}
		</main>
	{/if}
</div>
