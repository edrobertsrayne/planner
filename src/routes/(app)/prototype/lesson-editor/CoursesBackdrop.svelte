<script lang="ts">
	// A static stand-in for today's Courses screen, so the panel and modal variants open over real
	// context. Clicking a Lesson opens it in the editor.
	import TagChips from '$lib/components/tag-chips.svelte';
	import { course, lessons, topics } from './fake.svelte';

	// `besidePanel` folds away the Course and Topic panes and pins the Lesson list to the left, so
	// it stays readable beside variant C's panel.
	let {
		selectedId,
		onopen,
		besidePanel = false
	}: { selectedId: string | null; onopen: (id: string) => void; besidePanel?: boolean } = $props();
	const waves = $derived(lessons.filter((l) => l.topicId === 't2'));
</script>

<div
	class="flex flex-col py-6 {besidePanel
		? 'w-[calc(100vw-min(52rem,60vw))] px-6 max-lg:hidden'
		: 'mx-auto max-w-6xl px-6'}"
>
	<h1 class="mb-4 text-xl font-semibold tracking-tight">Courses</h1>
	<div class="flex min-h-[32rem] rounded-lg border">
		<aside class="w-64 shrink-0 border-r py-3 {besidePanel ? 'hidden' : ''}">
			<h2 class="px-4 pb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
				Courses
			</h2>
			<div class="truncate bg-muted px-4 py-1.5 text-sm font-medium">{course.name}</div>
			<div class="px-4 py-1.5 text-sm">A-level Physics</div>
		</aside>
		<aside class="w-64 shrink-0 border-r py-3 {besidePanel ? 'hidden' : ''}">
			<h2 class="px-4 pb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
				Topics
			</h2>
			{#each topics as t (t.id)}
				<div class="truncate px-4 py-1.5 text-sm {t.id === 't2' ? 'bg-muted font-medium' : ''}">
					{t.name}
				</div>
			{/each}
		</aside>
		<main class="min-w-0 flex-1">
			<div class="border-b px-6 py-4">
				<h2 class="text-base font-semibold">Waves</h2>
				<p class="mt-1 text-xs text-muted-foreground">{waves.length} Lessons</p>
			</div>
			<ol class="divide-y">
				{#each waves as l, i (l.id)}
					<li>
						<button
							type="button"
							class="flex w-full items-baseline gap-3 py-1.5 pr-3 pl-6 text-left text-sm hover:bg-muted/60 {l.id ===
							selectedId
								? 'bg-muted font-medium'
								: ''}"
							onclick={() => onopen(l.id)}
						>
							<span class="w-6 shrink-0 font-mono text-xs text-muted-foreground/60">{i + 1}</span>
							<span class="min-w-0 flex-1 truncate">{l.title}</span>
							<TagChips tags={l.tags} class="max-w-40 shrink justify-end self-center" />
						</button>
					</li>
				{/each}
			</ol>
		</main>
	</div>
</div>
