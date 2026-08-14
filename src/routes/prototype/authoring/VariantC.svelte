<script lang="ts">
	// PROTOTYPE — throwaway. Variant C: "authoring is a mode, not a place."
	//
	// Structure: the teaching app keeps its three tabs and gains nothing. Writing
	// content is a full-screen overlay — a compose window — opened from a Write
	// button in the header (or ⌘K) from anywhere, and closed back to whatever you
	// were doing. The Agenda is visible behind it on purpose.
	//
	// Answer to "where does authoring live": nowhere in the navigation. It is an
	// activity you enter and leave, like composing mail, not a fourth destination.
	//
	// Fast entry is the whole design: one textarea, one Lesson per line, a live
	// count, and "Add 12 Lessons" at the end. Twelve titles is one paragraph of
	// typing with no per-row focus management and nothing to click between lines.
	// Detail comes later, from the same overlay, in a slide-over.
	import {
		COURSES,
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
		fmtDate,
		type Lesson
	} from './fixtures.svelte';

	let open = $state(true);
	let courseId = $state('c9');
	// open on a real half-written Topic — the empty state is a click away and
	// wastes the first look
	let topicId = $state<string | null>(topicsOf('c9').find((t) => t.name === 'Energy')?.id ?? null);
	let bulk = $state('');
	let detail = $state<Lesson | null>(null);
	let newTopicName = $state('');
	let linkUrl = $state('');
	let linkLabel = $state('');

	const BULK_PLACEHOLDER = [
		'Energy stores',
		'Energy transfers',
		'Conservation of energy',
		'…'
	].join('\n');

	const topics = $derived(topicsOf(courseId));
	const topic = $derived(topicId ? topicById(topicId) : null);
	const lines = $derived(
		bulk
			.split('\n')
			.map((s) => s.trim())
			.filter(Boolean)
	);
	const teaching = $derived(topicId ? classesTeaching(topicId) : []);

	function commitBulk() {
		if (!topicId || !lines.length) return;
		for (const t of lines) addLesson(topicId, t);
		bulk = '';
	}

	function createTopic() {
		const n = newTopicName.trim();
		if (!n) return;
		topicId = addTopic(courseId, n).id;
		newTopicName = '';
	}

	function onkeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			open = !open;
		}
		if (e.key === 'Escape' && open) {
			if (detail) detail = null;
			else open = false;
		}
	}
</script>

<svelte:window {onkeydown} />

<!-- the teaching app, untouched — three tabs, Agenda showing -->
<div class="min-h-screen bg-neutral-50 pb-28 text-neutral-900">
	<header class="border-b border-neutral-200 bg-white">
		<div class="mx-auto flex max-w-3xl items-baseline gap-4 px-6 pt-5">
			<h1 class="text-lg font-semibold tracking-tight">Planner</h1>
			<span class="text-sm text-neutral-500">Tuesday, 24 November 2026</span>
			<span
				class="rounded bg-neutral-900 px-2 py-0.5 text-xs font-bold tracking-wider text-white uppercase"
				>Week B</span
			>
			<button
				class="ml-auto rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
				onclick={() => (open = true)}
				>Write <span class="ml-1 font-mono text-[11px] text-neutral-400">⌘K</span></button
			>
		</div>
		<nav class="mx-auto flex max-w-3xl gap-1 px-6 pt-4">
			{#each ['Agenda', 'Calendar', 'Classes'] as label (label)}
				<button
					class="-mb-px border-b-2 px-4 py-2 text-sm font-medium {label === 'Agenda'
						? 'border-neutral-900 text-neutral-900'
						: 'border-transparent text-neutral-400'}"
					disabled={label !== 'Agenda'}>{label}</button
				>
			{/each}
		</nav>
	</header>

	<div class="mx-auto max-w-3xl px-6 py-6">
		<h2 class="mb-2 text-sm font-semibold">Today — Tuesday, 24 November 2026</h2>
		<ul
			class="divide-y divide-neutral-100 overflow-hidden rounded-lg bg-white ring-1 ring-neutral-200"
		>
			{#each [['P1', '12A/Ph1', 'Stress, strain and the Young modulus'], ['P2', '8D/Sc3', 'Group 7: the halogens'], ['P4', '10A/Sc2', 'Half-life'], ['P5', '13A/Ph1', 'Resonance and damping'], ['P6', '11C/Sc1', 'The wave equation']] as [p, c, t] (p)}
				<li class="flex gap-3 px-4 py-3 text-sm">
					<span class="w-7 shrink-0 font-mono text-xs text-neutral-400">{p}</span>
					<span class="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-semibold"
						>{c}</span
					>
					<span class="min-w-0 flex-1">{t}</span>
				</li>
			{/each}
		</ul>
		<p class="mt-6 text-xs text-neutral-400">
			The teaching app is unchanged — three tabs, no Courses anywhere in the navigation. Content is
			written from the Write button, over the top of whatever you were looking at.
		</p>
	</div>
</div>

{#if open}
	<!-- the compose window -->
	<div class="fixed inset-0 z-40 flex items-end justify-center bg-neutral-900/40 p-6 pt-24">
		<div
			class="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
		>
			<div class="flex items-center gap-3 border-b border-neutral-200 px-5 py-3">
				<span class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">Writing</span>
				<select
					class="rounded border border-neutral-300 px-2 py-1 text-sm font-medium"
					bind:value={courseId}
					onchange={() => {
						topicId = null;
						detail = null;
					}}
				>
					{#each COURSES as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
				</select>
				<select
					class="min-w-48 rounded border border-neutral-300 px-2 py-1 text-sm"
					bind:value={topicId}
					onchange={() => (detail = null)}
				>
					<option value={null}>— pick a Topic —</option>
					{#each topics as t (t.id)}<option value={t.id}>{t.name} ({t.lessons.length})</option
						>{/each}
				</select>
				<button
					class="ml-auto text-neutral-400 hover:text-neutral-900"
					onclick={() => (open = false)}>✕ <span class="font-mono text-[11px]">esc</span></button
				>
			</div>

			<div class="flex min-h-0 flex-1">
				<div class="flex min-w-0 flex-1 flex-col">
					{#if !topic}
						<div class="flex flex-1 flex-col items-center justify-center gap-3 px-10">
							<p class="text-sm text-neutral-500">
								Pick a Topic above, or start a new one in {courseById(courseId).name}.
							</p>
							<div class="flex gap-2">
								<input
									class="w-72 rounded border border-neutral-300 px-3 py-2 text-sm"
									placeholder="New Topic name…"
									bind:value={newTopicName}
									onkeydown={(e) => e.key === 'Enter' && createTopic()}
								/>
								<button
									class="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
									onclick={createTopic}>Create</button
								>
							</div>
						</div>
					{:else}
						<!-- the bulk box is the primary affordance, and it sits at the top -->
						<div class="border-b border-neutral-200 bg-neutral-50 px-6 py-4">
							<label class="block">
								<span class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase"
									>Add Lessons to {topic.name} — one per line</span
								>
								<textarea
									rows="6"
									class="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm leading-relaxed"
									placeholder={BULK_PLACEHOLDER}
									bind:value={bulk}></textarea>
							</label>
							<div class="mt-2 flex items-center gap-3">
								<button
									class="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-30"
									disabled={!lines.length}
									onclick={commitBulk}
									>Add {lines.length}
									{lines.length === 1 ? 'Lesson' : 'Lessons'}</button
								>
								<span class="text-xs text-neutral-400"
									>They append in the order typed. Notes and links come later.</span
								>
							</div>
						</div>

						<ol class="flex-1 divide-y divide-neutral-100 overflow-y-auto">
							{#each topic.lessons as l, i (l.id)}
								<li class="group flex items-center gap-2 pr-3 hover:bg-neutral-50">
									<button
										class="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-6 text-left text-sm"
										onclick={() => (detail = l)}
									>
										<span class="w-6 shrink-0 font-mono text-xs text-neutral-300">{i + 1}</span>
										<span class="min-w-0 flex-1 truncate">{l.title}</span>
										{#if l.length > 1}<span
												class="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[11px]"
												>{l.length}P</span
											>{/if}
										{#if l.body}<span class="shrink-0 text-xs text-neutral-300">✎</span>{/if}
										{#if l.links.length}<span class="shrink-0 text-[11px] text-neutral-300"
												>🔗{l.links.length}</span
											>{/if}
									</button>
									<span class="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
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
												if (detail?.id === l.id) detail = null;
											}}
											aria-label="Delete">✕</button
										>
									</span>
								</li>
							{/each}
							{#if !topic.lessons.length}
								<li class="px-6 py-8 text-sm text-neutral-400">
									No Lessons yet — type them into the box above.
								</li>
							{/if}
						</ol>

						{#if teaching.length}
							<div
								class="border-t border-neutral-200 bg-amber-50 px-6 py-2.5 text-xs text-amber-900"
							>
								{#each teaching as x (x.cls.id)}
									<span class="mr-4"
										><span class="font-semibold">{x.cls.label}</span> now runs to
										{fmtDate(lastPlannedDate(x.cls.id))}</span
									>
								{/each}
								<span class="text-amber-700/70">— changing this Topic moved these dates.</span>
							</div>
						{/if}
					{/if}
				</div>

				<!-- detail slide-over, inside the compose window -->
				{#if detail}
					{@const l = detail}
					<aside class="w-96 shrink-0 overflow-y-auto border-l border-neutral-200 bg-neutral-50">
						<div class="flex items-start justify-between px-5 py-4">
							<input
								class="min-w-0 flex-1 border-0 bg-transparent p-0 text-base font-semibold focus:ring-0 focus:outline-none"
								bind:value={l.title}
							/>
							<button
								class="ml-2 shrink-0 text-neutral-400 hover:text-neutral-900"
								onclick={() => (detail = null)}>✕</button
							>
						</div>
						<div class="space-y-5 px-5 pb-8">
							<label class="block">
								<span class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase"
									>Planned Length</span
								>
								<div class="mt-1 flex items-center gap-2">
									<input
										type="number"
										min="1"
										max="6"
										class="w-16 rounded border border-neutral-300 bg-white px-2 py-1 text-sm"
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
									rows="14"
									class="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2 font-mono text-xs leading-relaxed"
									placeholder="Markdown…"
									bind:value={l.body}></textarea>
							</label>
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
										class="min-w-0 flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
										placeholder="Label"
										bind:value={linkLabel}
									/>
									<input
										class="min-w-0 flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
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
					</aside>
				{/if}
			</div>

			<div
				class="flex items-center gap-4 border-t border-neutral-200 px-5 py-2.5 text-xs text-neutral-400"
			>
				<span>Esc closes · ⌘K toggles</span>
				<span class="ml-auto"
					>{CLASSES.filter((c) => c.courseId === courseId)
						.map((c) => c.label)
						.join(', ') || 'no Class'} follows this Course</span
				>
			</div>
		</div>
	</div>
{/if}
