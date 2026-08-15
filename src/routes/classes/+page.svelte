<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
	const PERIODS = [1, 2, 3, 4, 5, 6];
	const WEEKS = ['A', 'B'] as const;

	let mode = $state<'year' | 'date'>('year');
	let fromDate = $state('');

	// Reset the local edit state whenever the server sends a new class or a new "changes apply
	// from" — a class switch or an accepted edit, never a keystroke in the date input itself.
	$effect(() => {
		mode = data.effectiveFrom ? 'date' : 'year';
		fromDate = data.effectiveFrom ?? data.yearStart ?? '';
	});

	const effectiveFrom = $derived(mode === 'date' && fromDate ? fromDate : '');

	function applyEffective() {
		const params = [
			data.class && `class=${encodeURIComponent(data.class.id)}`,
			effectiveFrom && `from=${encodeURIComponent(effectiveFrom)}`
		].filter(Boolean);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- carries a query string
		goto(`?${params.join('&')}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
			invalidateAll: true
		});
	}

	const labelOf = (classId: string) =>
		data.classes.find((c) => c.id === classId)?.label.split('/')[0] ?? '?';

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

	let newLabel = $state('');
	let newCourse = $state('');
	$effect(() => {
		if (!data.courses.some((c) => c.id === newCourse)) newCourse = data.courses[0]?.id ?? '';
	});
</script>

<svelte:head><title>Classes</title></svelte:head>

<div class="flex min-h-0 flex-1">
	<!-- rail: every Class -->
	<aside class="flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-white py-3">
		<h2 class="px-4 pb-2 text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
			Classes
		</h2>
		<div class="flex-1 overflow-y-auto">
			{#each data.classes as c (c.id)}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- href carries a query string -->
				<a
					href={`?class=${c.id}`}
					class="block px-4 py-2 text-sm hover:bg-neutral-50 {c.id === data.class?.id
						? 'bg-neutral-100 font-medium'
						: ''}"
				>
					{c.label}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/each}
		</div>
		<form
			method="POST"
			action="?/createClass"
			class="space-y-1.5 px-4 pt-2"
			use:enhance={() => {
				return async ({ formElement, result }) => {
					const created =
						result.type === 'success' && (result.data as { class?: { id: string } })?.class;
					if (created) {
						formElement.reset();
						newLabel = '';
						// eslint-disable-next-line svelte/no-navigation-without-resolve -- carries a query string
						await goto(`?class=${created.id}`, {
							replaceState: true,
							noScroll: true,
							keepFocus: true,
							invalidateAll: true
						});
					} else {
						await applyAction(result);
					}
				};
			}}
		>
			<input
				name="label"
				required
				autocomplete="off"
				bind:value={newLabel}
				class="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:border-neutral-900 focus:outline-none"
				placeholder="9B/Sc1"
			/>
			<select
				name="courseId"
				bind:value={newCourse}
				class="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
			>
				{#each data.courses as course (course.id)}
					<option value={course.id}>{course.name}</option>
				{/each}
			</select>
			<button
				type="submit"
				class="w-full rounded bg-neutral-900 px-2 py-1 text-xs text-white"
				disabled={!data.courses.length}
			>
				Create Class
			</button>
			{#if !data.courses.length}
				<p class="text-[11px] text-neutral-400">Write a Course first.</p>
			{/if}
			{#if form?.error}
				<p role="alert" class="text-[11px] text-neutral-500">{form.error}</p>
			{/if}
		</form>
	</aside>

	<!-- the Class page -->
	<main class="min-w-0 flex-1 overflow-y-auto">
		{#if !data.class}
			<div class="p-10 text-sm text-neutral-400">Pick a Class, or create one.</div>
		{:else}
			<div class="border-b border-neutral-200 bg-white px-8 py-5">
				<div class="flex items-baseline gap-3">
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
														aria-label="Week {w} {d} P{p} — held by {labelOf(slot.classId)}"
													>
														{labelOf(slot.classId)}
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
					Hatched periods belong to another Class — you cannot be in two rooms at once. A double is
					two periods, ticked separately.
				</p>

				{#if data.datedSlots.length}
					<div class="mt-4 rounded-lg bg-white p-3 ring-1 ring-neutral-200">
						<p class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
							Dated periods
						</p>
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
		{/if}
	</main>
</div>
