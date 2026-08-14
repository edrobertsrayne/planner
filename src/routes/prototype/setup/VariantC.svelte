<script lang="ts">
	// PROTOTYPE — throwaway. Variant C: type it in.
	//
	// The bet: forty-four periods is a typing job, not a clicking job. The
	// timetable opens as a full-screen transcription grid of text boxes — type
	// the label, Tab across, Enter down — and a Class that does not exist yet is
	// *created by typing it*, which inverts the ticket's "Course first, then
	// Class" order deliberately: the sheet in front of you has class labels on
	// it, not Courses, so you transcribe first and say what each Class is
	// studying afterwards, from the strip along the bottom.
	//
	// The Classes surface itself is a dense table rather than cards, and Assign
	// Topic is a keyboard-driven modal — ↑/↓ and Enter, the same stepping idiom
	// the Lesson editor landed on in #22.
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
		moveAssigned,
		runway,
		slotAt,
		slotsOf,
		takeSlot,
		topicById,
		topicsOf,
		unassignTopic
	} from './fixtures.svelte';

	let entering = $state(false);
	let from = $state(YEAR_START);
	let assigning = $state<string | null>(null);
	let cursor = $state(0);

	/** Classes typed into the grid that still owe us a Course. */
	let pending = $state<string[]>([]);

	const key = (w: string, d: number, p: number) => `${w}-${d}-${p}`;
	const labelAt = (w: (typeof WEEKS)[number], d: number, p: number) => {
		const s = slotAt(w, d, p, from);
		return s ? classById(s.classId).label : '';
	};

	function commit(w: (typeof WEEKS)[number], d: number, p: number, raw: string) {
		const text = raw.trim();
		if (!text) {
			clearSlot(w, d, p, from);
			return;
		}
		const existing = CLASSES.find((c) => c.label.toLowerCase() === text.toLowerCase());
		if (existing) {
			takeSlot(w, d, p, existing.id, from);
			return;
		}
		// unknown label — the Class is born here, and owes us a Course
		const k = addClass(text, '');
		pending.push(k.id);
		takeSlot(w, d, p, k.id, from);
	}

	function move(w: (typeof WEEKS)[number], d: number, p: number, dp: number, dd: number) {
		const wi = WEEKS.indexOf(w);
		let nd = d + dd;
		let nw = wi;
		if (nd > 4) {
			nd = 0;
			nw = 1;
		}
		if (nd < 0) {
			nd = 4;
			nw = 0;
		}
		const np = p + dp;
		if (np < 1 || np > 6) return;
		document.getElementById(`c-${key(WEEKS[nw], nd, np)}`)?.focus();
	}

	const picker = $derived(assigning ? topicsOf(classById(assigning).courseId) : []);

	function onkeydown(e: KeyboardEvent) {
		if (!assigning) return;
		if (e.key === 'Escape') {
			assigning = null;
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			cursor = Math.min(cursor + 1, picker.length - 1);
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			cursor = Math.max(cursor - 1, 0);
		}
		if (e.key === 'Enter' && picker[cursor]) {
			assignTopic(assigning, picker[cursor].id);
			assigning = null;
		}
	}
</script>

<svelte:window {onkeydown} />

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

	<main class="flex-1 px-8 py-6 pb-28">
		<div class="flex items-baseline gap-3">
			<h2 class="text-sm font-semibold">Classes</h2>
			<span class="text-xs text-neutral-400"
				>{CLASSES.length} Classes · {SLOTS.filter(
					(s) => s.from <= TODAY && (!s.to || s.to >= TODAY)
				).length} periods a fortnight</span
			>
			<button
				class="ml-auto rounded bg-neutral-900 px-3 py-1.5 text-xs text-white"
				onclick={() => (entering = true)}>Enter timetable</button
			>
		</div>

		<!-- one dense row per Class: everything about the year, sortable by eye -->
		<table
			class="mt-3 w-full border-separate border-spacing-0 overflow-hidden rounded-lg bg-white text-sm ring-1 ring-neutral-200"
		>
			<thead>
				<tr class="text-left text-[11px] tracking-wider text-neutral-400 uppercase">
					<th class="px-4 py-2 font-bold">Class</th>
					<th class="px-4 py-2 font-bold">Course</th>
					<th class="px-4 py-2 font-bold">Periods</th>
					<th class="px-4 py-2 font-bold">Teaching order</th>
					<th class="px-4 py-2 font-bold">Left</th>
					<th class="px-4 py-2"></th>
				</tr>
			</thead>
			<tbody>
				{#each CLASSES as c (c.id)}
					{@const r = runway(c.id)}
					<tr class="border-t border-neutral-100 align-top">
						<td class="border-t border-neutral-100 px-4 py-3">
							<span class="flex items-center gap-2 font-medium">
								<span class="h-2.5 w-2.5 rounded-sm {TONE[c.tone].dot}"></span>{c.label}
							</span>
						</td>
						<td class="border-t border-neutral-100 px-4 py-3">
							{#if c.courseId}
								<span class="text-neutral-600">{courseById(c.courseId).name}</span>
							{:else}
								<!-- typed into the grid, Course still owed -->
								<select
									class="rounded border border-amber-400 bg-amber-50 px-2 py-1 text-xs"
									onchange={(e) => {
										c.courseId = (e.currentTarget as HTMLSelectElement).value;
										pending = pending.filter((id) => id !== c.id);
									}}
								>
									<option value="">Pick a Course…</option>
									{#each COURSES as co (co.id)}
										<option value={co.id}>{co.name}</option>
									{/each}
								</select>
							{/if}
						</td>
						<td class="border-t border-neutral-100 px-4 py-3 font-mono text-xs text-neutral-500"
							>{slotsOf(c.id, TODAY).length}</td
						>
						<td class="border-t border-neutral-100 px-4 py-3">
							<ol class="flex flex-wrap gap-1">
								{#each c.assigned as tid, i (tid + i)}
									<li
										class="group flex items-baseline gap-1 rounded px-1.5 py-0.5 text-xs ring-1 {TONE[
											c.tone
										].chip}"
									>
										<span>{topicById(tid).name}</span>
										<span class="opacity-0 group-hover:opacity-100">
											<button onclick={() => moveAssigned(c.id, i, i - 1)} aria-label="Move up"
												>←</button
											>
											<button onclick={() => moveAssigned(c.id, i, i + 1)} aria-label="Move down"
												>→</button
											>
											<button onclick={() => unassignTopic(c.id, i)} aria-label="Unassign">✕</button
											>
										</span>
									</li>
								{/each}
								<li>
									<button
										class="ring-dashed rounded px-1.5 py-0.5 text-xs text-neutral-400 ring-1 ring-neutral-300 hover:text-neutral-900"
										disabled={!c.courseId}
										onclick={() => {
											assigning = c.id;
											cursor = 0;
										}}>+ Topic</button
									>
								</li>
							</ol>
						</td>
						<td class="border-t border-neutral-100 px-4 py-3">
							<span class="font-mono text-xs {r.left < 6 ? 'text-amber-700' : 'text-neutral-500'}"
								>{r.left}</span
							>
						</td>
						<td class="border-t border-neutral-100 px-4 py-3 text-right">
							<button
								class="text-xs text-neutral-300 hover:text-neutral-900"
								onclick={() => (entering = true)}>timetable</button
							>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		{#if pending.length}
			<p class="mt-3 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
				{pending.length} Class{pending.length > 1 ? 'es' : ''} typed into the timetable still need a Course
				before anything can be assigned to {pending.length > 1 ? 'them' : 'it'}.
			</p>
		{/if}
	</main>
</div>

<!-- the transcription grid, full screen because it is a sitting, not a glance -->
{#if entering}
	<div class="fixed inset-0 z-40 overflow-auto bg-white p-8">
		<div class="mx-auto max-w-6xl">
			<div class="flex items-baseline gap-3">
				<h2 class="text-lg font-semibold tracking-tight">Enter the timetable</h2>
				<span class="text-xs text-neutral-400"
					>Type a Class label · Tab across · Enter down · blank clears</span
				>
				<span class="ml-auto flex items-center gap-2 text-xs">
					<span class="text-neutral-400">These changes hold from</span>
					<input
						type="date"
						class="rounded border border-neutral-300 px-2 py-1 text-xs"
						bind:value={from}
					/>
					<button
						class="ml-2 rounded bg-neutral-900 px-3 py-1.5 text-xs text-white"
						onclick={() => (entering = false)}>Done</button
					>
				</span>
			</div>

			{#if from !== YEAR_START}
				<p
					class="mt-3 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900 ring-1 ring-amber-200"
				>
					Anything you change here starts on <strong>{fmtLong(from)}</strong>. What it replaces ends
					the day before, so Sessions already taught keep their Class.
				</p>
			{/if}

			<datalist id="labels">
				{#each CLASSES as c (c.id)}
					<option value={c.label}></option>
				{/each}
			</datalist>

			<div class="mt-5 flex gap-10">
				{#each WEEKS as w (w)}
					<table class="border-separate border-spacing-1">
						<thead>
							<tr>
								<th
									class="w-8 pb-1 text-left text-[11px] font-bold tracking-wider text-neutral-900 uppercase"
									>Week {w}</th
								>
								{#each DAYS as d (d)}
									<th class="w-24 pb-1 text-xs font-semibold text-neutral-500">{d}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each PERIODS as p (p)}
								<tr>
									<th class="pr-1 text-right text-xs font-medium text-neutral-400">P{p}</th>
									{#each DAYS as d, i (d)}
										{@const s = slotAt(w, i, p, from)}
										<td>
											<input
												id="c-{key(w, i, p)}"
												list="labels"
												class="h-9 w-24 rounded border px-2 text-center text-xs {s
													? TONE[classById(s.classId).tone].cell + ' border-transparent'
													: 'border-neutral-200 bg-white'} focus:border-neutral-900 focus:ring-0 focus:outline-none"
												aria-label="Week {w} {d} P{p}"
												value={labelAt(w, i, p)}
												onchange={(e) => commit(w, i, p, e.currentTarget.value)}
												onkeydown={(e) => {
													if (e.key === 'Enter') {
														e.preventDefault();
														commit(w, i, p, e.currentTarget.value);
														move(w, i, p, 1, 0);
													}
													if (e.key === 'ArrowDown') move(w, i, p, 1, 0);
													if (e.key === 'ArrowUp') move(w, i, p, -1, 0);
												}}
											/>
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				{/each}
			</div>

			<p class="mt-5 text-xs text-neutral-400">
				A label you have not used before creates the Class — you say which Course it follows on the
				Classes table afterwards. A double is the same label twice, in consecutive periods.
			</p>
		</div>
	</div>
{/if}

<!-- Assign Topic: keyboard-first, the same modal stepping as the Lesson editor -->
{#if assigning}
	{@const c = classById(assigning)}
	<div class="fixed inset-0 z-50 flex items-start justify-center bg-neutral-900/40 p-6 pt-32">
		<div class="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
			<div class="flex items-baseline gap-2 border-b border-neutral-200 px-4 py-2.5">
				<span class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase"
					>Assign a Topic to {c.label}</span
				>
				<span class="ml-auto text-[11px] text-neutral-400">{courseById(c.courseId).name}</span>
			</div>
			<ul class="max-h-80 overflow-y-auto py-1">
				{#each picker as t, i (t.id)}
					{@const mine = c.assigned.includes(t.id)}
					{@const others = alsoAssigned(t.id, c.id)}
					<li>
						<button
							class="flex w-full items-baseline gap-2 px-4 py-2 text-left text-sm {i === cursor
								? 'bg-neutral-900 text-white'
								: 'hover:bg-neutral-50'}"
							onmouseenter={() => (cursor = i)}
							onclick={() => {
								assignTopic(c.id, t.id);
								assigning = null;
							}}
						>
							<span class="min-w-0 flex-1 truncate">{t.name}</span>
							{#if mine}
								<span class="shrink-0 text-[11px] opacity-60">already in the order</span>
							{:else if others.length}
								<span class="shrink-0 text-[11px] opacity-60"
									>{others.map((o) => o.label).join(', ')}</span
								>
							{/if}
							<span class="shrink-0 font-mono text-xs opacity-50">{t.lessons.length || '—'}</span>
						</button>
					</li>
				{/each}
			</ul>
			<p class="border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-400">
				↑ ↓ to move, Enter to assign, Esc to close. Assigning re-runs the schedule from today —
				{runway(c.id).left} Lessons left before this one.
			</p>
		</div>
	</div>
{/if}
