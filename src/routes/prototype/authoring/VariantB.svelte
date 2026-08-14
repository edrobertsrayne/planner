<script lang="ts">
	// PROTOTYPE — throwaway. Variant B: "a Topic is a document, reached through
	// the Class that needs it."
	//
	// Structure: no browser, no panes, no tree. There is no Courses tab at all —
	// the Classes tab gets deeper. You land on a Class ("9B runs out of Lessons
	// on 12 Feb"), and its Assigned Topics are stacked below as documents you
	// scroll through. Writing next half-term is: open the Class, hit "Write a new
	// Topic", type.
	//
	// Answer to "where does authoring live": nowhere of its own. Content is
	// approached from the teaching that needs it, which is how ADR-0010's
	// just-in-time assignment actually works in practice.
	//
	// Fast entry: every Lesson title *is* an input, all the time. Enter opens the
	// next line, Backspace on an empty line deletes it and moves up, ⌘↑/⌘↓
	// reorder. Twelve titles is exactly twelve lines of typing, no save anywhere.
	import {
		CLASSES,
		courseById,
		topicsOf,
		topicById,
		addTopic,
		addLesson,
		removeLesson,
		moveLesson,
		addLink,
		classesTeaching,
		lastPlannedDate,
		fmtDate
	} from './fixtures.svelte';

	let classId = $state('9B');
	let expanded = $state<string | null>(null);
	let linkUrl = $state('');
	let linkLabel = $state('');
	let picking = $state(false);

	const cls = $derived(CLASSES.find((c) => c.id === classId)!);
	const course = $derived(courseById(cls.courseId));
	const assigned = $derived(cls.assigned.map(topicById));
	const unassigned = $derived(topicsOf(cls.courseId).filter((t) => !cls.assigned.includes(t.id)));
	const runsOut = $derived(lastPlannedDate(classId));

	/** where this Class is up to, in the flattened Assigned Topic sequence */
	function doneIn(topicId: string) {
		return classesTeaching(topicId).find((x) => x.cls.id === classId);
	}

	function focusLine(topicId: string, index: number) {
		queueMicrotask(() => {
			const el = document.querySelector<HTMLInputElement>(
				`[data-line="${topicId}:${index}"] input`
			);
			el?.focus();
			el?.select();
		});
	}

	function onLineKey(e: KeyboardEvent, topicId: string, i: number, isLast: boolean) {
		const t = topicById(topicId);
		if (e.key === 'Enter') {
			e.preventDefault();
			addLesson(topicId, '', i + 1);
			focusLine(topicId, i + 1);
		} else if (e.key === 'Backspace' && t.lessons[i].title === '' && t.lessons.length > 1) {
			e.preventDefault();
			removeLesson(topicId, t.lessons[i].id);
			focusLine(topicId, Math.max(0, i - 1));
		} else if ((e.metaKey || e.ctrlKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
			e.preventDefault();
			const to = i + (e.key === 'ArrowUp' ? -1 : 1);
			moveLesson(topicId, i, to);
			focusLine(topicId, to);
		} else if (e.key === 'ArrowUp' && i > 0) {
			e.preventDefault();
			focusLine(topicId, i - 1);
		} else if (e.key === 'ArrowDown' && !isLast) {
			e.preventDefault();
			focusLine(topicId, i + 1);
		}
	}

	function newTopic() {
		const t = addTopic(cls.courseId, '');
		cls.assigned.push(t.id);
		addLesson(t.id, '');
		queueMicrotask(() => {
			document.querySelector<HTMLInputElement>(`[data-topic-name="${t.id}"]`)?.focus();
		});
	}
</script>

<div class="min-h-screen bg-neutral-50 pb-28 text-neutral-900">
	<header class="border-b border-neutral-200 bg-white">
		<div class="mx-auto flex max-w-4xl items-baseline gap-4 px-6 pt-5">
			<h1 class="text-lg font-semibold tracking-tight">Planner</h1>
			<span class="text-sm text-neutral-500">Tuesday, 24 November 2026</span>
			<span
				class="rounded bg-neutral-900 px-2 py-0.5 text-xs font-bold tracking-wider text-white uppercase"
				>Week B</span
			>
		</div>
		<nav class="mx-auto flex max-w-4xl gap-1 px-6 pt-4">
			{#each ['Agenda', 'Calendar', 'Classes'] as label (label)}
				<button
					class="-mb-px border-b-2 px-4 py-2 text-sm font-medium {label === 'Classes'
						? 'border-neutral-900 text-neutral-900'
						: 'border-transparent text-neutral-400'}"
					disabled={label !== 'Classes'}>{label}</button
				>
			{/each}
		</nav>
	</header>

	<!-- the Class you are writing for -->
	<div class="border-b border-neutral-200 bg-white">
		<div class="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-6 py-3">
			{#each CLASSES as c (c.id)}
				<button
					class="shrink-0 rounded-full px-3 py-1 text-sm font-medium {c.id === classId
						? 'bg-neutral-900 text-white'
						: 'text-neutral-500 hover:bg-neutral-100'}"
					onclick={() => {
						classId = c.id;
						expanded = null;
					}}>{c.label}</button
				>
			{/each}
		</div>
	</div>

	<div class="mx-auto max-w-4xl px-6 py-8">
		<div class="mb-8">
			<h2 class="text-2xl font-semibold tracking-tight">{cls.label}</h2>
			<p class="mt-1 text-sm text-neutral-500">
				{course.name} · {assigned.length} Assigned Topics
			</p>
			<p class="mt-3 rounded-lg bg-white px-4 py-3 text-sm ring-1 ring-neutral-200">
				At this rate <span class="font-medium">{cls.label}</span> runs out of Lessons on
				<span class="font-semibold">{fmtDate(runsOut)}</span>. Everything you write below moves that
				date.
			</p>
		</div>

		{#each assigned as t, ti (t.id)}
			{@const progress = doneIn(t.id)}
			<section class="mb-10">
				<div class="mb-2 flex items-baseline gap-3">
					<span class="font-mono text-xs text-neutral-300">{ti + 1}</span>
					<input
						data-topic-name={t.id}
						class="min-w-0 flex-1 border-0 border-b border-transparent bg-transparent p-0 text-lg font-semibold tracking-tight hover:border-neutral-200 focus:border-neutral-900 focus:ring-0 focus:outline-none"
						placeholder="Topic name…"
						bind:value={t.name}
					/>
					{#if progress?.finished}
						<span class="shrink-0 text-xs font-medium text-neutral-400">done</span>
					{:else if progress?.started}
						<span class="shrink-0 text-xs font-medium text-emerald-700"
							>teaching now · {progress.doneHere}/{progress.here}</span
						>
					{:else}
						<span class="shrink-0 text-xs text-neutral-400">queued</span>
					{/if}
				</div>

				<ol class="rounded-lg bg-white ring-1 ring-neutral-200">
					{#each t.lessons as l, i (l.id)}
						{@const taught = (progress?.doneHere ?? 0) > i}
						<li
							data-line="{t.id}:{i}"
							class="group border-b border-neutral-100 last:border-0 {taught
								? 'bg-neutral-50'
								: ''}"
						>
							<div class="flex items-center gap-2 px-3">
								<span class="w-6 shrink-0 text-right font-mono text-xs text-neutral-300"
									>{i + 1}</span
								>
								<input
									class="min-w-0 flex-1 border-0 bg-transparent px-1 py-2.5 text-sm focus:ring-0 focus:outline-none {taught
										? 'text-neutral-500'
										: ''}"
									placeholder="Lesson title…"
									bind:value={l.title}
									onkeydown={(e) => onLineKey(e, t.id, i, i === t.lessons.length - 1)}
								/>
								{#if l.length > 1}
									<span
										class="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600"
										>{l.length}P</span
									>
								{/if}
								{#if l.links.length}
									<span class="shrink-0 text-[11px] text-neutral-300">🔗{l.links.length}</span>
								{/if}
								{#if taught}<span class="shrink-0 text-xs text-neutral-300" title="already taught"
										>✓</span
									>{/if}
								<button
									class="shrink-0 px-1 text-neutral-300 hover:text-neutral-900"
									onclick={() => (expanded = expanded === l.id ? null : l.id)}
									aria-label="Details">{expanded === l.id ? '⌄' : '›'}</button
								>
							</div>

							{#if expanded === l.id}
								<div class="space-y-4 border-t border-neutral-100 bg-neutral-50/60 px-10 py-4">
									<label class="block">
										<span class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase"
											>Notes & objectives</span
										>
										<textarea
											rows="8"
											class="mt-1 w-full rounded border border-neutral-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed"
											placeholder="Markdown…"
											bind:value={l.body}></textarea>
									</label>
									<div class="flex items-end gap-6">
										<label class="block">
											<span class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase"
												>Planned Length</span
											>
											<div class="mt-1 flex items-center gap-2">
												<input
													type="number"
													min="1"
													max="6"
													class="w-16 rounded border border-neutral-200 bg-white px-2 py-1 text-sm"
													bind:value={l.length}
												/>
												<span class="text-sm text-neutral-500">Periods</span>
											</div>
										</label>
										<button
											class="pb-1 text-xs text-neutral-400 hover:text-red-600"
											onclick={() => {
												removeLesson(t.id, l.id);
												expanded = null;
											}}>Delete Lesson</button
										>
									</div>
									<div>
										<span class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase"
											>Links</span
										>
										<ul class="mt-1 space-y-1">
											{#each l.links as k (k.id)}
												<li
													class="flex items-baseline gap-2 rounded bg-white px-2 py-1.5 text-sm ring-1 ring-neutral-200"
												>
													<span class="text-neutral-300">🔗</span>
													<span class="min-w-0 flex-1 truncate">{k.label}</span>
													<span class="font-mono text-[10px] text-neutral-400"
														>{new URL(k.url).hostname}</span
													>
												</li>
											{/each}
										</ul>
										<div class="mt-2 flex gap-1">
											<input
												class="min-w-0 flex-1 rounded border border-neutral-200 bg-white px-2 py-1 text-xs"
												placeholder="Label"
												bind:value={linkLabel}
											/>
											<input
												class="min-w-0 flex-1 rounded border border-neutral-200 bg-white px-2 py-1 text-xs"
												placeholder="https://…"
												bind:value={linkUrl}
											/>
											<button
												class="rounded bg-neutral-900 px-2 text-xs text-white"
												onclick={() => {
													if (!linkUrl.trim() || !linkLabel.trim()) return;
													addLink(l, linkUrl.trim(), linkLabel.trim());
													linkUrl = '';
													linkLabel = '';
												}}>Add</button
											>
										</div>
									</div>
								</div>
							{/if}
						</li>
					{/each}
				</ol>
				<p class="mt-1.5 pl-9 text-[11px] text-neutral-400">
					Enter for the next Lesson · ⌘↑ ⌘↓ to reorder · Backspace on an empty line deletes it
				</p>
			</section>
		{/each}

		<div class="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-6">
			<button
				class="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
				onclick={newTopic}>Write a new Topic</button
			>
			{#if unassigned.length}
				<button
					class="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 ring-1 ring-neutral-300 hover:bg-white"
					onclick={() => (picking = !picking)}
					>Assign a Topic already in {course.name} ({unassigned.length})</button
				>
			{/if}
		</div>
		{#if picking}
			<ul class="mt-3 overflow-hidden rounded-lg bg-white ring-1 ring-neutral-200">
				{#each unassigned as t (t.id)}
					<li>
						<button
							class="flex w-full items-baseline justify-between border-b border-neutral-100 px-4 py-2.5 text-left text-sm last:border-0 hover:bg-neutral-50"
							onclick={() => {
								cls.assigned.push(t.id);
								picking = false;
							}}
						>
							<span>{t.name}</span>
							<span class="font-mono text-xs text-neutral-400">{t.lessons.length} Lessons</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
