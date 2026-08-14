<script lang="ts">
	// PROTOTYPE — throwaway. Variant D: the composite Ed asked for out of A and C.
	//   - A's shell: Courses as a fourth tab, three-pane browser
	//     (Courses | Topics | Lessons)
	//   - A's fast entry: sticky append input at the foot of the Lesson list
	//   - C's editor: the Lesson opens as a roomy centred modal instead of being
	//     squashed into a 24rem side panel. Two columns inside — the markdown body
	//     gets real width, everything structural sits beside it.
	//   - the Lesson pane keeps the full remaining width, because nothing has to
	//     share the screen with the editor any more
	//   - ↑/↓ in the modal walk the Topic without closing, so "add bodies to last
	//     Sunday's twelve titles" is one pass rather than twelve open/close cycles
	import {
		COURSES,
		topicsOf,
		topicById,
		addCourse,
		addTopic,
		addLesson,
		removeLesson,
		moveLesson,
		reparentLesson,
		addLink,
		classesTeaching,
		lastPlannedDate,
		fmtDate
	} from './fixtures.svelte';

	let courseId = $state('c9');
	let topicId = $state<string | null>(null);
	let lessonId = $state<string | null>(null);
	let draft = $state('');
	let newTopic = $state('');
	let addingTopic = $state(false);
	let newCourse = $state('');
	let addingCourse = $state(false);
	let linkUrl = $state('');
	let linkLabel = $state('');

	const topics = $derived(topicsOf(courseId));
	const topic = $derived(topicId ? topicById(topicId) : null);
	const index = $derived(
		topic && lessonId ? topic.lessons.findIndex((l) => l.id === lessonId) : -1
	);
	const lesson = $derived(topic && index >= 0 ? topic.lessons[index] : null);
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

	function commitCourse(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		const n = newCourse.trim();
		if (!n) return;
		// a new Course starts empty — the Topics pane is then the obvious next move
		pickCourse(addCourse(n).id);
		newCourse = '';
		addingCourse = false;
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

	function step(delta: number) {
		if (!topic || index < 0) return;
		const next = index + delta;
		if (next < 0 || next >= topic.lessons.length) return;
		lessonId = topic.lessons[next].id;
	}

	function onkeydown(e: KeyboardEvent) {
		if (!lesson) return;
		const el = document.activeElement as HTMLElement | null;
		const typing =
			el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
		if (e.key === 'Escape') {
			lessonId = null;
			return;
		}
		if (typing) return;
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			step(-1);
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			step(1);
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
				<button
					class="flex w-full items-baseline justify-between px-4 py-2 text-left text-sm hover:bg-neutral-50 {c.id ===
					courseId
						? 'bg-neutral-100 font-medium'
						: ''}"
					onclick={() => pickCourse(c.id)}
				>
					<span>{c.name}</span>
					<span class="font-mono text-xs text-neutral-400">{topicsOf(c.id).length}</span>
				</button>
			{/each}
			<div class="px-4 pt-2">
				{#if addingCourse}
					<!-- svelte-ignore a11y_autofocus -->
					<input
						autofocus
						class="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
						placeholder="Course name…"
						bind:value={newCourse}
						onkeydown={commitCourse}
						onblur={() => (addingCourse = false)}
					/>
				{:else}
					<button
						class="text-sm text-neutral-500 hover:text-neutral-900"
						onclick={() => (addingCourse = true)}>+ New Course</button
					>
				{/if}
			</div>
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

		<!-- pane 3: Lessons — now the full remaining width, since the editor is modal -->
		<main class="flex min-w-0 flex-1 flex-col pb-24">
			{#if !topic}
				<div class="p-10 text-sm text-neutral-400">Pick a Topic.</div>
			{:else}
				<div class="flex items-baseline gap-4 border-b border-neutral-200 bg-white px-8 py-4">
					<h2 class="text-base font-semibold">{topic.name}</h2>
					<span class="text-xs text-neutral-500">
						{topic.lessons.length} Lessons ·
						{#if teaching.length}
							taught by {teaching.map((x) => x.cls.label).join(', ')}
						{:else}
							not assigned to any Class yet
						{/if}
					</span>
					{#if teaching.length}
						<span class="ml-auto text-xs text-neutral-400">
							{#each teaching as x (x.cls.id)}
								<span class="ml-3"
									><span class="font-medium text-neutral-600">{x.cls.label}</span> runs to
									{fmtDate(lastPlannedDate(x.cls.id))}</span
								>
							{/each}
						</span>
					{/if}
				</div>

				<ol class="flex-1 divide-y divide-neutral-100 overflow-y-auto bg-white">
					{#each topic.lessons as l, i (l.id)}
						<li class="group flex items-start gap-2 pr-6 hover:bg-neutral-50">
							<button
								class="flex min-w-0 flex-1 items-start gap-4 py-2.5 pl-8 text-left"
								onclick={() => (lessonId = l.id)}
							>
								<span class="w-6 shrink-0 pt-0.5 font-mono text-xs text-neutral-300">{i + 1}</span>
								<span class="min-w-0 flex-1">
									<span class="block">{l.title}</span>
									{#if l.body}
										<span class="mt-0.5 block truncate text-xs text-neutral-400"
											>{l.body.replace(/[#*\-\n]+/g, ' ').slice(0, 120)}</span
										>
									{/if}
								</span>
								{#if l.length > 1}
									<span
										class="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600"
										>{l.length} periods</span
									>
								{/if}
								{#if l.links.length}
									<span class="shrink-0 pt-0.5 text-xs text-neutral-300">🔗{l.links.length}</span>
								{/if}
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
					{#if !topic.lessons.length}
						<li class="px-8 py-8 text-sm text-neutral-400">
							No Lessons yet — type the first title below.
						</li>
					{/if}
				</ol>

				<div class="border-t border-neutral-200 bg-white px-8 py-3">
					<input
						class="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
						placeholder="New Lesson title — press Enter"
						bind:value={draft}
						onkeydown={commit}
					/>
					<p class="mt-1.5 text-[11px] text-neutral-400">
						Title alone is a complete Lesson. Open one to add notes and links whenever.
					</p>
				</div>
			{/if}
		</main>
	</div>
</div>

<!-- the Lesson editor, as C's modal rather than A's side panel -->
{#if lesson && topic}
	{@const t = topic}
	{@const l = lesson}
	<div class="fixed inset-0 z-40 flex items-center justify-center bg-neutral-900/40 p-6 sm:p-12">
		<div
			class="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
		>
			<div class="flex items-center gap-3 border-b border-neutral-200 px-6 py-3">
				<span class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase"
					>{t.name} · Lesson {index + 1} of {t.lessons.length}</span
				>
				<span class="ml-auto flex items-center gap-0.5">
					<button
						class="rounded px-2 py-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-25"
						disabled={index === 0}
						onclick={() => step(-1)}
						aria-label="Previous Lesson">↑</button
					>
					<button
						class="rounded px-2 py-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-25"
						disabled={index === t.lessons.length - 1}
						onclick={() => step(1)}
						aria-label="Next Lesson">↓</button
					>
				</span>
				<button
					class="ml-2 text-sm text-neutral-400 hover:text-neutral-900"
					onclick={() => (lessonId = null)}
					>Done <span class="font-mono text-[11px]">esc</span></button
				>
			</div>

			<input
				class="border-0 px-6 pt-4 pb-2 text-xl font-semibold tracking-tight focus:ring-0 focus:outline-none"
				placeholder="Lesson title…"
				bind:value={l.title}
			/>

			<div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_18rem] gap-6 px-6 pt-2 pb-6">
				<!-- the body gets the room it never had in the side panel -->
				<label class="flex min-h-0 flex-col">
					<span class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase"
						>Notes & objectives</span
					>
					<textarea
						class="mt-1.5 min-h-72 flex-1 resize-none rounded-lg border border-neutral-300 px-4 py-3 font-mono text-xs leading-relaxed focus:border-neutral-900 focus:outline-none"
						placeholder="Markdown — objectives, what to set up, what went wrong last time…"
						bind:value={l.body}></textarea>
				</label>

				<div class="flex min-h-0 flex-col gap-5 overflow-y-auto">
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

					<div>
						<span class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase"
							>Links</span
						>
						<ul class="mt-1 space-y-1">
							{#each l.links as k (k.id)}
								<li class="flex items-baseline gap-2 rounded bg-neutral-50 px-2 py-1.5 text-sm">
									<span class="text-neutral-300">🔗</span>
									<span class="min-w-0 flex-1 truncate">{k.label}</span>
									<span class="shrink-0 font-mono text-[10px] text-neutral-400"
										>{new URL(k.url).hostname.split('.')[0]}</span
									>
								</li>
							{/each}
						</ul>
						<!-- label above url, so the label gets the full column width; Add
						     stays alongside the url, which tolerates truncation and the
						     label does not -->
						<div class="mt-2 space-y-1">
							<input
								class="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
								placeholder="Label"
								bind:value={linkLabel}
							/>
							<div class="flex gap-1">
								<input
									class="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-xs"
									placeholder="https://…"
									bind:value={linkUrl}
								/>
								<button
									class="shrink-0 rounded bg-neutral-900 px-2.5 text-xs text-white"
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
									lessonId = null;
								}
							}}
						>
							<option value={t.id}>{t.name}</option>
							{#each topicsOf(courseId).filter((x) => x.id !== t.id) as x (x.id)}
								<option value={x.id}>{x.name}</option>
							{/each}
						</select>
					</div>

					{#if teaching.length}
						<div class="mt-auto rounded-lg bg-neutral-50 px-3 py-2.5 text-xs">
							<div class="font-semibold text-neutral-600">Taught by</div>
							{#each teaching as x (x.cls.id)}
								<div class="mt-1 text-neutral-500">
									<span class="font-medium text-neutral-700">{x.cls.label}</span>
									— {x.doneHere} of {x.here} done · year runs to
									{fmtDate(lastPlannedDate(x.cls.id))}
								</div>
							{/each}
							<div class="mt-1.5 text-[11px] text-neutral-400">
								Adding or removing a Lesson moves those dates.
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
