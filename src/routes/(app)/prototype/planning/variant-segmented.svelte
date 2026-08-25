<script lang="ts">
	import { classLabel, dateText, soonest, type MockLesson, type Status } from './data';
	import StreamShell from './stream-shell.svelte';

	// A — the prototyped row, third rung removed. Two joined buttons in one bordered box,
	// hard right. Nothing else about the row changes; the readiness chips leave a gap.

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
		{ key: 'bare', name: 'Bare' },
		{ key: 'drafted', name: 'Drafted' }
	];
</script>

<StreamShell
	{lessons}
	note="A — Segmented control, hard right. The prototyped ladder with the Ready rung removed."
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

			<div class="flex shrink-0 overflow-hidden rounded-md border text-xs" role="group">
				{#each RUNGS as rung (rung.key)}
					<button
						type="button"
						aria-pressed={lesson.status === rung.key}
						class="px-2 py-1.5 transition-colors {lesson.status === rung.key
							? 'bg-primary text-primary-foreground'
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
