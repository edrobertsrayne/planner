<script lang="ts">
	import { classLabel, dateText, soonest, type MockLesson, type Status } from './data';
	import StreamShell from './stream-shell.svelte';

	// B — the row control matches the Lesson editor's control settled on #105: a single-select
	// chip group, separate pills, exactly one always selected. Same shape as the filter chips
	// at the top of the stream, which is either a virtue (one language) or a hazard (a chip
	// that filters and a chip that writes look identical).

	let {
		lessons,
		setStatus,
		onOpen
	}: {
		lessons: MockLesson[];
		setStatus: (id: string, status: Status) => void;
		onOpen: (lesson: MockLesson) => void;
	} = $props();

	const RUNGS: { key: Status; name: string }[] = [
		{ key: 'draft', name: 'Draft' },
		{ key: 'planned', name: 'Planned' }
	];
</script>

<StreamShell
	{lessons}
	note="B — Chip group on the row, the same control the Lesson editor uses (#105). Separate pills, one always selected."
>
	{#snippet row(lesson: MockLesson)}
		{@const s = soonest(lesson)}
		<li class="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
			<div class="w-24 shrink-0 text-right">
				{#if s}
					<div class="text-sm font-medium tabular-nums">{dateText(s)}</div>
					<div class="text-xs text-muted-foreground tabular-nums">
						{s.period} · {classLabel(s.classId)}
					</div>
				{:else}
					<div class="text-sm text-muted-foreground">—</div>
					<div class="text-[11px] text-muted-foreground">unscheduled</div>
				{/if}
			</div>

			<div class="min-w-0 flex-1 border-l pl-3">
				<button
					type="button"
					class="text-left text-sm font-medium hover:underline"
					onclick={() => onOpen(lesson)}
				>
					{lesson.title}
				</button>
				<p class="truncate text-xs text-muted-foreground">
					{lesson.topicName} · {lesson.courseName}
				</p>
			</div>

			<div class="flex shrink-0 items-center gap-1" role="group" aria-label="Planning status">
				{#each RUNGS as rung (rung.key)}
					<button
						type="button"
						aria-pressed={lesson.status === rung.key}
						class="rounded-full border px-3 py-1 text-xs transition-colors {lesson.status ===
						rung.key
							? 'border-transparent bg-primary text-primary-foreground'
							: 'hover:bg-muted'}"
						onclick={() => setStatus(lesson.id, rung.key)}
					>
						{rung.name}
					</button>
				{/each}
			</div>
		</li>
	{/snippet}
</StreamShell>
