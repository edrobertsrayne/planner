<script lang="ts">
	// PROTOTYPE — throwaway. Variant A: "Courses is a fourth tab."
	//
	// Structure: a three-pane browser — Courses | Topics | Lessons — with the
	// Lesson editor as a right-hand panel, deliberately the same shape as the
	// Session panel from #6. One surface, everything reachable by clicking.
	//
	// Answer to "where does authoring live": a fourth tab, a peer of Agenda,
	// Calendar and Classes. Content is a thing you browse.
	//
	// Fast entry: a sticky "new Lesson" input pinned to the bottom of the Lesson
	// list. Type a title, Enter, it appends and the input clears and keeps focus.
	// Twelve titles is twelve Enters and no mouse.
	import {
		COURSES,
		topicsOf,
		topicById,
		addTopic,
		addLesson,
		removeLesson,
		moveLesson,
		reparentLesson,
		addLink,
		classesTeaching,
		lastPlannedDate,
		fmtDate,
		type Lesson
	} from './fixtures.svelte';

	let courseId = $state('c9');
	let topicId = $state<string | null>(null);
	let lessonId = $state<string | null>(null);
	let draft = $state('');
	let newTopic = $state('');
	let addingTopic = $state(false);
	let linkUrl = $state('');
	let linkLabel = $state('');

	const topics = $derived(topicsOf(courseId));
	const topic = $derived(topicId ? topicById(topicId) : null);
	const lesson = $derived<Lesson | null>(
		(topic && lessonId
			? (topic.lessons.find((l) => l.id === lessonId) ?? null)
			: null) as Lesson | null
	);
	const teaching = $derived(topicId ? classesTeaching(topicId) : []);

	function pickCourse(id: string) {
		courseId = id;
		topicId = null;
		lessonId = null;
	}

	function commit(e: KeyboardEvent) {
		if (e.key !== 'Enter' || !topicId) return;
		const t = draft.trim();
		if (!t) return;
		addLesson(topicId, t);
		draft = '';
	}

	function commitTopic(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		const n = newTopic.trim();
		if (!n) return;
		topicId = addTopic(courseId, n).id;
		newTopic = '';
		addingTopic = false;
		lessonId = null;
	}

	function saveLink() {
		if (!lesson || !linkUrl.trim() || !linkLabel.trim()) return;
		addLink(lesson, linkUrl.trim(), linkLabel.trim());
		linkUrl = '';
		linkLabel = '';
	}
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
					class="-mb-px border-b-2 px-4 py-2 text-sm font-medium {label === 'Courses'
						? 'border-neutral-900 text-neutral-900'
						: 'border-transparent text-neutral-400'}"
					disabled={label !== 'Courses'}>{label}</button
				>
			{/each}
		</nav>
	</header>

	<div class="flex min-h-0 flex-1">
		<!-- pane 1: Courses -->
		<aside class="w-56 shrink-0 border-r border-neutral-200 bg-white py-3">
			<h2 class="px-4 pb-2 text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
				Courses
			</h2>
			{#each COURSES as c (c.id)}
				{@const n = topicsOf(c.id).length}
				<button
					class="flex w-full items-baseline justify-between px-4 py-2 text-left text-sm hover:bg-neutral-50 {c.id ===
					courseId
						? 'bg-neutral-100 font-medium'
						: ''}"
					onclick={() => pickCourse(c.id)}
				>
					<span>{c.name}</span>
					<span class="font-mono text-xs text-neutral-400">{n}</span>
				</button>
			{/each}
		</aside>

		<!-- pane 2: Topics -->
		<aside class="w-64 shrink-0 border-r border-neutral-200 bg-white py-3">
			<h2 class="px-4 pb-2 text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
				Topics
			</h2>
			{#each topics as t (t.id)}
				<button
					class="flex w-full items-baseline justify-between px-4 py-2 text-left text-sm hover:bg-neutral-50 {t.id ===
					topicId
						? 'bg-neutral-100 font-medium'
						: ''}"
					onclick={() => {
						topicId = t.id;
						lessonId = null;
					}}
				>
					<span class="min-w-0 truncate">{t.name}</span>
					<span class="ml-2 shrink-0 font-mono text-xs text-neutral-400"
						>{t.lessons.length || '—'}</span
					>
				</button>
			{/each}
			<div class="px-4 pt-2">
				{#if addingTopic}
					<!-- svelte-ignore a11y_autofocus -->
					<input
						autofocus
						class="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
						placeholder="Topic name…"
						bind:value={newTopic}
						onkeydown={commitTopic}
						onblur={() => (addingTopic = false)}
					/>
				{:else}
					<button
						class="text-sm text-neutral-500 hover:text-neutral-900"
						onclick={() => (addingTopic = true)}>+ New Topic</button
					>
				{/if}
			</div>
		</aside>

		<!-- pane 3: Lessons -->
		<main class="flex min-w-0 flex-1 flex-col pb-24">
			{#if !topic}
				<div class="p-10 text-sm text-neutral-400">Pick a Topic.</div>
			{:else}
				<div class="border-b border-neutral-200 bg-white px-6 py-4">
					<h2 class="text-base font-semibold">{topic.name}</h2>
					<p class="mt-1 text-xs text-neutral-500">
						{topic.lessons.length} Lessons ·
						{#if teaching.length}
							taught by {teaching.map((x) => x.cls.label).join(', ')}
						{:else}
							not assigned to any Class yet
						{/if}
					</p>
				</div>

				<ol class="flex-1 divide-y divide-neutral-100 overflow-y-auto bg-white">
					{#each topic.lessons as l, i (l.id)}
						<li class="group flex items-start gap-2 pr-3 hover:bg-neutral-50">
							<button
								class="flex min-w-0 flex-1 items-start gap-3 py-2.5 pl-6 text-left {l.id ===
								lessonId
									? 'font-medium'
									: ''}"
								onclick={() => (lessonId = l.id)}
							>
								<span class="w-6 shrink-0 pt-0.5 font-mono text-xs text-neutral-300">{i + 1}</span>
								<span class="min-w-0 flex-1">{l.title}</span>
								{#if l.length > 1}
									<span
										class="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium"
										>{l.length} periods</span
									>
								{/if}
								{#if l.body}<span class="shrink-0 text-xs text-neutral-300" title="has notes"
										>✎</span
									>{/if}
								{#if l.links.length}<span class="shrink-0 text-xs text-neutral-300"
										>🔗{l.links.length}</span
									>{/if}
							</button>
							<span
								class="flex shrink-0 items-center gap-0.5 pt-2 opacity-0 group-hover:opacity-100"
							>
								<button
									class="px-1 text-neutral-400 hover:text-neutral-900"
									onclick={() => moveLesson(topic.id, i, i - 1)}
									aria-label="Move up">↑</button
								>
								<button
									class="px-1 text-neutral-400 hover:text-neutral-900"
									onclick={() => moveLesson(topic.id, i, i + 1)}
									aria-label="Move down">↓</button
								>
								<button
									class="px-1 text-neutral-400 hover:text-red-600"
									onclick={() => {
										removeLesson(topic.id, l.id);
										if (lessonId === l.id) lessonId = null;
									}}
									aria-label="Delete">✕</button
								>
							</span>
						</li>
					{/each}
				</ol>

				<div class="border-t border-neutral-200 bg-white px-6 py-3">
					<input
						class="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
						placeholder="New Lesson title — press Enter"
						bind:value={draft}
						onkeydown={commit}
					/>
					<p class="mt-1.5 text-[11px] text-neutral-400">
						Title alone is a complete Lesson. Add notes and links whenever.
					</p>
				</div>
			{/if}
		</main>

		<!-- pane 4: the Lesson editor, same shape as the Session panel -->
		{#if lesson && topic}
			{@const t = topic}
			{@const l = lesson}
			<aside class="w-96 shrink-0 overflow-y-auto border-l border-neutral-200 bg-white pb-24">
				<div class="flex items-start justify-between border-b border-neutral-100 px-5 py-4">
					<div class="min-w-0">
						<div class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
							{t.name}
						</div>
						<input
							class="mt-1 w-full border-0 p-0 text-base font-semibold focus:ring-0 focus:outline-none"
							bind:value={l.title}
						/>
					</div>
					<button
						class="ml-2 text-neutral-400 hover:text-neutral-900"
						onclick={() => (lessonId = null)}>✕</button
					>
				</div>

				<div class="space-y-5 px-5 py-4">
					<label class="block">
						<span class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase"
							>Planned Length</span
						>
						<div class="mt-1 flex items-center gap-2">
							<input
								type="number"
								min="1"
								max="6"
								class="w-16 rounded border border-neutral-300 px-2 py-1 text-sm"
								bind:value={l.length}
							/>
							<span class="text-sm text-neutral-500">Periods</span>
						</div>
					</label>

					<label class="block">
						<span class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase"
							>Notes & objectives</span
						>
						<textarea
							rows="12"
							class="mt-1 w-full rounded border border-neutral-300 px-3 py-2 font-mono text-xs leading-relaxed"
							placeholder="Markdown…"
							bind:value={l.body}></textarea>
					</label>

					<div>
						<span class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase"
							>Links</span
						>
						<ul class="mt-1 space-y-1">
							{#each l.links as k (k.id)}
								<li class="flex items-baseline gap-2 rounded bg-neutral-50 px-2 py-1.5 text-sm">
									<span class="text-neutral-300">🔗</span>
									<span class="min-w-0 flex-1 truncate">{k.label}</span>
									<span class="truncate font-mono text-[10px] text-neutral-400"
										>{new URL(k.url).hostname}</span
									>
								</li>
							{/each}
						</ul>
						<div class="mt-2 flex gap-1">
							<input
								class="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-xs"
								placeholder="Label"
								bind:value={linkLabel}
							/>
							<input
								class="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-xs"
								placeholder="https://…"
								bind:value={linkUrl}
							/>
							<button class="rounded bg-neutral-900 px-2 text-xs text-white" onclick={saveLink}
								>Add</button
							>
						</div>
					</div>

					<div>
						<span class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase"
							>Move to Topic</span
						>
						<select
							class="mt-1 w-full rounded border border-neutral-300 px-2 py-1 text-sm"
							onchange={(e) => {
								const to = (e.currentTarget as HTMLSelectElement).value;
								if (to && to !== t.id) {
									reparentLesson(t.id, l.id, to);
									topicId = to;
								}
							}}
						>
							<option value={t.id}>{t.name}</option>
							{#each topicsOf(courseId).filter((x) => x.id !== t.id) as x (x.id)}
								<option value={x.id}>{x.name}</option>
							{/each}
						</select>
					</div>

					<!-- editing content moves dates: stated quietly, as a fact about the Classes -->
					{#if teaching.length}
						<div class="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs">
							<div class="font-semibold text-neutral-600">Taught by</div>
							{#each teaching as x (x.cls.id)}
								<div class="mt-1 text-neutral-500">
									<span class="font-medium text-neutral-700">{x.cls.label}</span>
									— {x.doneHere} of {x.here} done · rest of the year currently ends
									{fmtDate(lastPlannedDate(x.cls.id))}
								</div>
							{/each}
							<div class="mt-1.5 text-[11px] text-neutral-400">
								Adding or removing a Lesson here moves those dates.
							</div>
						</div>
					{/if}
				</div>
			</aside>
		{/if}
	</div>
</div>

<style>
	:global(body) {
		overflow-x: hidden;
	}
</style>
